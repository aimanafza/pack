import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from datetime import date
from typing import List, Optional
from app.models.user import User
from app.models.item import WardrobeItem
from app.models.trip import Trip, ReservedItem, BagEntry, PackingItem, DesignRationale, Outfit
from app.api.deps import get_current_user
from app.services.claude_service import generate_restyle_outfit, generate_single_outfit_image, generate_lookbook_image

router = APIRouter()


class ReservedItemBody(BaseModel):
    name: str
    weight_grams: int = 0


class BagEntryBody(BaseModel):
    bag_id: str
    bag_type: str
    label: str
    weight_limit_grams: int
    empty_bag_weight_grams: int
    available_grams: int


class TripBody(BaseModel):
    name: str
    destination: str
    start_date: date
    end_date: date
    occasions: List[str] = []
    climate: str = ""
    notes: str = ""
    bags: List[BagEntryBody] = []
    reserved_items: List[ReservedItemBody] = []
    weight_unit: str = "kg"


class TripUpdateBody(BaseModel):
    name: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    occasions: Optional[List[str]] = None
    climate: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class CheckItemBody(BaseModel):
    item_id: str
    checked: bool


class ApproveOutfitBody(BaseModel):
    outfit_name: str


class RejectOutfitBody(BaseModel):
    outfit_name: str
    kept_items: List[str] = []


class RestyleBody(BaseModel):
    kept_item_ids: List[str]
    rejected_outfit_id: str


class UnapproveOutfitsBody(BaseModel):
    outfit_names: List[str]


@router.get("/")
async def get_trips(current_user: User = Depends(get_current_user)):
    trips = await Trip.find(Trip.user_id == current_user.id).to_list()
    return {"success": True, "data": [t.model_dump() for t in trips], "message": ""}


@router.post("/")
async def create_trip(body: TripBody, current_user: User = Depends(get_current_user)):
    duration = (body.end_date - body.start_date).days
    bags = [BagEntry(**b.model_dump()) for b in body.bags]
    reserved = [ReservedItem(name=r.name, weight_grams=r.weight_grams) for r in body.reserved_items]
    total_available = sum(b.available_grams for b in bags) - sum(r.weight_grams for r in reserved)
    trip = Trip(
        user_id=current_user.id,
        name=body.name,
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
        duration_days=duration,
        occasions=body.occasions,
        climate=body.climate,
        notes=body.notes,
        bags=bags,
        reserved_items=reserved,
        available_clothing_weight_grams=max(0, total_available),
        weight_unit=body.weight_unit,
    )
    await trip.insert()
    return {"success": True, "data": trip.model_dump(), "message": "Trip created"}


@router.get("/{trip_id}")
async def get_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"success": True, "data": trip.model_dump(), "message": ""}


@router.put("/{trip_id}")
async def update_trip(trip_id: str, body: TripUpdateBody, current_user: User = Depends(get_current_user)):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    updates = body.model_dump(exclude_none=True)
    # Recalculate duration_days if either date changed
    start = updates.get('start_date', trip.start_date)
    end = updates.get('end_date', trip.end_date)
    updates['duration_days'] = (end - start).days
    if updates:
        await trip.set(updates)
    return {"success": True, "data": trip.model_dump(), "message": "Trip updated"}


@router.delete("/{trip_id}")
async def delete_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    await trip.delete()
    return {"success": True, "data": None, "message": "Trip deleted"}


@router.patch("/{trip_id}/approve-outfit")
async def approve_outfit(trip_id: str, body: ApproveOutfitBody, current_user: User = Depends(get_current_user)):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    if body.outfit_name not in trip.approved_outfits:
        trip.approved_outfits.append(body.outfit_name)
    total = len(trip.packing_list.outfits) if trip.packing_list else 0
    reviewed = len(trip.approved_outfits) + len(trip.rejected_outfits)
    trip.status = "packed" if (total and reviewed >= total) else "reviewing"
    await trip.save()
    return {"success": True, "data": trip.model_dump(), "message": "Outfit approved"}


@router.patch("/{trip_id}/reject-outfit")
async def reject_outfit(trip_id: str, body: RejectOutfitBody, current_user: User = Depends(get_current_user)):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    if body.outfit_name not in trip.rejected_outfits:
        trip.rejected_outfits.append(body.outfit_name)
    total = len(trip.packing_list.outfits) if trip.packing_list else 0
    reviewed = len(trip.approved_outfits) + len(trip.rejected_outfits)
    trip.status = "packed" if (total and reviewed >= total) else "reviewing"
    await trip.save()
    return {"success": True, "data": trip.model_dump(), "message": "Outfit rejected"}


@router.post("/{trip_id}/outfits/restyle")
async def restyle_outfit(
    trip_id: str,
    body: RestyleBody,
    current_user: User = Depends(get_current_user),
):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    wardrobe = await WardrobeItem.find(WardrobeItem.user_id == current_user.id).to_list()
    wardrobe_by_id = {str(item.id): item for item in wardrobe}
    preferences = current_user.preferences.model_dump()

    # Collect anchor item IDs from approved outfits (for Claude context)
    approved_names = set(trip.approved_outfits or [])
    approved_item_ids: set[str] = set()
    if trip.packing_list:
        for o in trip.packing_list.outfits:
            if o.name in approved_names:
                for item in o.items:
                    if item.wardrobe_item_id:
                        approved_item_ids.add(item.wardrobe_item_id)

    try:
        raw = await generate_restyle_outfit(
            trip=trip,
            wardrobe=wardrobe,
            kept_item_ids=body.kept_item_ids,
            preferences=preferences,
            approved_item_ids=approved_item_ids,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restyle error: {str(e)}")

    # Build PackingItems from Claude's response
    def make_item(raw_item: dict) -> Optional[PackingItem]:
        if not isinstance(raw_item, dict):
            return None
        item_id = str(raw_item.get("id") or raw_item.get("wardrobe_item_id") or "")
        wardrobe_item = wardrobe_by_id.get(item_id)
        weight_kg = (
            round(wardrobe_item.weight_grams / 1000, 3)
            if wardrobe_item and wardrobe_item.weight_grams
            else float(raw_item.get("estimated_weight_kg", 0.0))
        )
        return PackingItem(
            wardrobe_item_id=item_id if wardrobe_item else None,
            name=raw_item.get("name", ""),
            category=raw_item.get("category", "other"),
            image_url=wardrobe_item.image_url if wardrobe_item else None,
            checked=False,
            in_wardrobe=bool(wardrobe_item),
            estimated_weight_kg=weight_kg,
        )

    packing_items = [x for x in (make_item(i) for i in raw.get("items", [])) if x]

    rationale_data = raw.get("design_rationale")
    design_rationale = None
    if isinstance(rationale_data, dict):
        design_rationale = DesignRationale(
            silhouette=rationale_data.get("silhouette", ""),
            color_story=rationale_data.get("color_story", ""),
            occasion_fit=rationale_data.get("occasion_fit", ""),
            the_detail=rationale_data.get("the_detail", ""),
        )

    day_label = raw.get("day_label", "RESTYLED LOOK")
    occasion_tag = raw.get("occasion_tag", "")
    styling_notes = raw.get("styling_notes", "")

    new_outfit = Outfit(
        name=day_label,
        occasion=occasion_tag,
        styling_note=styling_notes,
        items=packing_items,
        outfit_id=raw.get("outfit_id", "restyle_1"),
        day_label=day_label,
        occasion_tag=occasion_tag,
        styling_notes=styling_notes,
        design_rationale=design_rationale,
        style_gaps=raw.get("style_gaps", []),
        total_weight=float(raw.get("total_weight", 0.0)),
        weight_note=raw.get("weight_note", ""),
    )

    # Generate avatar image for the new outfit before returning
    avatar = current_user.avatar if hasattr(current_user, "avatar") else None
    style_aesthetics = []
    if current_user.style_preferences and hasattr(current_user.style_preferences, "style_aesthetics"):
        style_aesthetics = current_user.style_preferences.style_aesthetics or []
    try:
        image_url = await generate_single_outfit_image(new_outfit, avatar, trip, style_aesthetics)
        if image_url:
            new_outfit.generated_image_url = image_url
    except Exception as e:
        logger.warning(f"Image generation failed for restyled outfit: {e}")

    # Append restyled outfit to the trip's packing list
    if trip.packing_list:
        trip.packing_list.outfits.append(new_outfit)
        await trip.save()

    return {"success": True, "data": new_outfit.model_dump(), "message": "Restyled"}


@router.post("/{trip_id}/generate-outfit-images")
async def generate_outfit_images(trip_id: str, current_user: User = Depends(get_current_user)):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not trip.packing_list or not trip.packing_list.outfits:
        raise HTTPException(status_code=400, detail="No outfits to generate images for")

    avatar = current_user.avatar if hasattr(current_user, "avatar") else None
    style_aesthetics = []
    if current_user.style_preferences and hasattr(current_user.style_preferences, "style_aesthetics"):
        style_aesthetics = current_user.style_preferences.style_aesthetics or []

    async def _generate_for_outfit(outfit):
        # Skip if image already generated
        if outfit.generated_image_url:
            return
        try:
            url = await generate_single_outfit_image(outfit, avatar, trip, style_aesthetics)
            if url:
                outfit.generated_image_url = url
            else:
                logger.warning(f"generate_single_outfit_image returned None for outfit: {outfit.name}")
        except Exception as e:
            logger.error(f"Image generation failed for outfit '{outfit.name}': {e}", exc_info=True)

    await asyncio.gather(*[_generate_for_outfit(o) for o in trip.packing_list.outfits])
    await trip.save()

    return {"success": True, "data": trip.model_dump(), "message": "Outfit images generated"}


@router.patch("/{trip_id}/unapprove-outfits")
async def unapprove_outfits(
    trip_id: str,
    body: UnapproveOutfitsBody,
    current_user: User = Depends(get_current_user),
):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    name_set = set(body.outfit_names)
    trip.approved_outfits = [n for n in trip.approved_outfits if n not in name_set]
    trip.rejected_outfits = [n for n in trip.rejected_outfits if n not in name_set]

    if trip.packing_list:
        for outfit in trip.packing_list.outfits:
            if outfit.name in name_set:
                outfit.lookbook_image_url = None

    trip.status = "reviewing" if trip.approved_outfits else "planning"
    await trip.save()
    return {"success": True, "data": trip.model_dump(), "message": "Outfits unapproved"}


@router.post("/{trip_id}/outfits/{outfit_id}/lookbook-image")
async def generate_outfit_lookbook_image(
    trip_id: str,
    outfit_id: str,
    current_user: User = Depends(get_current_user),
):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    if not trip.packing_list:
        raise HTTPException(status_code=404, detail="No packing list on this trip")

    outfit = next(
        (o for o in trip.packing_list.outfits if o.outfit_id == outfit_id), None
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Already generated — return immediately, never regenerate
    if outfit.lookbook_image_url:
        return {"lookbook_image_url": outfit.lookbook_image_url}

    user = await User.get(str(current_user.id))
    style_aesthetics = (
        user.preferences.style_aesthetics
        if user.preferences and user.preferences.style_aesthetics
        else []
    )

    url = await generate_lookbook_image(
        outfit, user.avatar, trip, style_aesthetics
    )
    if url:
        outfit.lookbook_image_url = url
        await trip.save()

    return {"lookbook_image_url": url}


@router.patch("/{trip_id}/check-item")
async def check_item(trip_id: str, body: CheckItemBody, current_user: User = Depends(get_current_user)):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.packing_list:
        for item in trip.packing_list.raw_items:
            if item.wardrobe_item_id == body.item_id or item.name == body.item_id:
                item.checked = body.checked
        for outfit in trip.packing_list.outfits:
            for item in outfit.items:
                if item.wardrobe_item_id == body.item_id or item.name == body.item_id:
                    item.checked = body.checked
        await trip.save()
    return {"success": True, "data": trip.model_dump(), "message": ""}
