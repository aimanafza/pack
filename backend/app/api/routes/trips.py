from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import date
from typing import List, Optional
from app.models.user import User
from app.models.trip import Trip, ReservedItem, BagEntry
from app.api.deps import get_current_user

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
