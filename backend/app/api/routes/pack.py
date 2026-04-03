from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.user import User
from app.models.item import WardrobeItem
from app.models.trip import Trip, PackingList, Outfit, PackingItem, DesignRationale
from app.api.deps import get_current_user
from app.services.claude_service import generate_packing_list
from datetime import datetime

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class SuggestBody(BaseModel):
    trip_id: str


# ── Validation helpers ─────────────────────────────────────────────────────

def validate_outfit_items(items: list) -> list:
    """Remove duplicate item IDs within a single outfit."""
    seen_ids = set()
    deduplicated = []
    for item in items:
        item_id = str(item.get("id") or item.get("_id") or "")
        if not item_id or item_id not in seen_ids:
            if item_id:
                seen_ids.add(item_id)
            deduplicated.append(item)
    return deduplicated


def validate_against_wardrobe(outfit_items: list, wardrobe_ids: set) -> list:
    """Remove any item whose ID doesn't exist in the user's wardrobe."""
    valid = []
    for item in outfit_items:
        item_id = str(item.get("id") or item.get("_id") or "")
        if item_id in wardrobe_ids:
            valid.append(item)
        else:
            print(f"WARNING: Claude suggested non-existent item '{item_id}' — removed")
    return valid


# ── Route ──────────────────────────────────────────────────────────────────

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

    # Build lookup maps for validation and image injection
    wardrobe_by_id = {str(item.id): item for item in wardrobe}
    wardrobe_ids = set(wardrobe_by_id.keys())

    try:
        raw = await generate_packing_list(trip, wardrobe, style_prefs, preferences)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stylist error: {str(e)}")

    # ── Build validated outfit list ────────────────────────────────────────

    def make_packing_item(raw_item: dict, wardrobe_by_id: dict) -> Optional[PackingItem]:
        """Convert a Claude outfit item dict to a PackingItem, injecting image_url."""
        if not isinstance(raw_item, dict):
            return None
        try:
            item_id = str(raw_item.get("id") or raw_item.get("wardrobe_item_id") or "")
            wardrobe_item = wardrobe_by_id.get(item_id)
            return PackingItem(
                wardrobe_item_id=item_id if wardrobe_item else None,
                name=raw_item.get("name", ""),
                category=raw_item.get("category", "other"),
                image_url=wardrobe_item.image_url if wardrobe_item else None,
                checked=False,
                in_wardrobe=bool(wardrobe_item),
            )
        except Exception:
            return None

    built_outfits = []
    # Track focal piece IDs used across outfits for cross-outfit dedup warning
    used_focal_ids: set[str] = set()

    for o in raw.get("outfits", []):
        if not isinstance(o, dict):
            continue

        raw_items = o.get("items", [])

        # Fix 1 — deduplicate within this outfit
        raw_items = validate_outfit_items(raw_items)

        # Fix 3 — remove hallucinated items (IDs not in wardrobe)
        raw_items = validate_against_wardrobe(raw_items, wardrobe_ids)

        # Fix 2 — warn on cross-outfit focal piece reuse (first item = anchor)
        if raw_items:
            focal_id = str(raw_items[0].get("id") or raw_items[0].get("_id") or "")
            if focal_id and focal_id in used_focal_ids:
                print(f"WARNING: focal piece '{focal_id}' reused across outfits")
            if focal_id:
                used_focal_ids.add(focal_id)

        packing_items = [x for x in (make_packing_item(i, wardrobe_by_id) for i in raw_items) if x]

        # Build design_rationale if present
        rationale_data = o.get("design_rationale")
        design_rationale = None
        if isinstance(rationale_data, dict):
            design_rationale = DesignRationale(
                silhouette=rationale_data.get("silhouette", ""),
                color_story=rationale_data.get("color_story", ""),
                occasion_fit=rationale_data.get("occasion_fit", ""),
                the_detail=rationale_data.get("the_detail", ""),
            )

        day_label = o.get("day_label", "")
        occasion_tag = o.get("occasion_tag", "")
        styling_notes = o.get("styling_notes", o.get("styling_note", ""))

        outfit = Outfit(
            # backward-compat fields
            name=day_label or o.get("name", ""),
            occasion=occasion_tag or o.get("occasion", ""),
            styling_note=styling_notes,
            items=packing_items,
            # new fields
            outfit_id=o.get("outfit_id", ""),
            day_label=day_label,
            occasion_tag=occasion_tag,
            styling_notes=styling_notes,
            design_rationale=design_rationale,
            style_gaps=o.get("style_gaps", []),
            total_weight=float(o.get("total_weight", 0.0)),
        )
        built_outfits.append(outfit)

    packing_summary = raw.get("packing_summary", raw.get("stylist_note", ""))

    packing_list = PackingList(
        generated_at=datetime.utcnow(),
        stylist_note=packing_summary,       # backward compat
        packing_summary=packing_summary,
        outfits=built_outfits,
        essentials=raw.get("essentials", []),
        raw_items=[],
    )

    trip.packing_list = packing_list
    trip.status = "planning"
    await trip.save()

    return {"success": True, "data": trip.model_dump(mode="json"), "message": "Packing list generated"}
