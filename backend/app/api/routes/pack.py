from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.user import User
from app.models.item import WardrobeItem
from app.models.trip import Trip, PackingList, Outfit, PackingItem
from app.api.deps import get_current_user
from app.services.claude_service import generate_packing_list
from datetime import datetime

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class SuggestBody(BaseModel):
    trip_id: str


@router.post("/suggest")
@limiter.limit("10/minute")
async def suggest_packing_list(
    request: Request,
    body: SuggestBody,
    current_user: User = Depends(get_current_user),
):
    trip = await Trip.get(body.trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    wardrobe = await WardrobeItem.find(WardrobeItem.user_id == current_user.id).to_list()
    style_prefs = current_user.style_preferences.model_dump()
    preferences = current_user.preferences.model_dump()

    # Build lookup so we can inject image_url after Claude returns IDs
    wardrobe_by_id = {str(item.id): item for item in wardrobe}

    try:
        raw = await generate_packing_list(trip, wardrobe, style_prefs, preferences)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stylist error: {str(e)}")

    # Claude sometimes returns raw_items as plain strings — handle both shapes
    def make_item(i) -> Optional[PackingItem]:
        if isinstance(i, str):
            return PackingItem(name=i, category="other", in_wardrobe=False)
        if not isinstance(i, dict):
            return None
        try:
            # Only pass known fields — Claude occasionally adds extra keys
            known = {k: v for k, v in i.items() if k in PackingItem.model_fields}
            item = PackingItem(**known)
            if item.wardrobe_item_id and item.wardrobe_item_id in wardrobe_by_id:
                item.image_url = wardrobe_by_id[item.wardrobe_item_id].image_url
            return item
        except Exception:
            return None

    try:
        packing_list = PackingList(
            generated_at=datetime.utcnow(),
            stylist_note=raw.get("stylist_note", ""),
            outfits=[
                Outfit(
                    name=o["name"],
                    occasion=o.get("occasion", ""),
                    items=[x for x in [make_item(i) for i in o.get("items", [])] if x],
                    styling_note=o.get("styling_note", ""),
                )
                for o in raw.get("outfits", [])
            ],
            essentials=raw.get("essentials", []),
            raw_items=[x for x in [make_item(i) for i in raw.get("raw_items", [])] if x],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build packing list: {str(e)}")

    trip.packing_list = packing_list
    trip.status = "planning"
    await trip.save()

    return {"success": True, "data": trip.model_dump(mode="json"), "message": "Packing list generated"}
