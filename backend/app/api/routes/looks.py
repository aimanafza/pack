from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pydantic import BaseModel
from beanie import PydanticObjectId

from app.models.look import Look
from app.models.item import WardrobeItem
from app.models.user import User
from app.api.deps import get_current_user
from app.services.claude_service import generate_item_styling_suggestions, generate_look_avatar_image

router = APIRouter()


class StyleItemRequest(BaseModel):
    occasion_note: str = ""
    inspiration_image_urls: List[str] = []
    count: int = 3


class ApproveLookRequest(BaseModel):
    anchor_item_id: str
    outfit_index: int
    outfits_payload: dict


@router.post("/wardrobe/{item_id}/suggest")
async def suggest_looks_for_item(
    item_id: str,
    body: StyleItemRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate N outfit suggestions for a single wardrobe item."""
    anchor = await WardrobeItem.get(item_id)
    if not anchor or str(anchor.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Item not found")

    wardrobe = await WardrobeItem.find(WardrobeItem.user_id == current_user.id).to_list()
    wardrobe_dicts = [
        {
            "id": str(w.id),
            "name": w.name,
            "category": w.category,
            "color": w.color if isinstance(w.color, list) else [w.color],
            "fabric": w.fabric,
            "occasions": w.occasions,
            "formality": w.formality if isinstance(w.formality, list) else [w.formality],
            "season": w.season,
            "image_url": w.image_url,
        }
        for w in wardrobe
    ]
    anchor_dict = next((x for x in wardrobe_dicts if x["id"] == item_id), None)
    if not anchor_dict:
        raise HTTPException(status_code=404, detail="Item not found in wardrobe list")

    style_prefs = {
        "style_dna": current_user.style_dna.model_dump() if current_user.style_dna else {},
        "preferences": current_user.preferences.model_dump() if current_user.preferences else {},
    }

    result = await generate_item_styling_suggestions(
        anchor_item=anchor_dict,
        wardrobe=wardrobe_dicts,
        style_prefs=style_prefs,
        occasion_note=body.occasion_note,
        inspiration_image_urls=body.inspiration_image_urls,
        count=body.count,
    )

    # Enrich outfits with image_urls for the flat-lay collage
    item_id_to_url = {d["id"]: d["image_url"] for d in wardrobe_dicts}
    for outfit in result.get("outfits", []):
        outfit["item_image_urls"] = [
            item_id_to_url[wid]
            for wid in outfit.get("wardrobe_item_ids", [])
            if wid in item_id_to_url and item_id_to_url[wid]
        ]

    return {"success": True, "data": result}


@router.post("/wardrobe/{item_id}/approve")
async def approve_look(
    item_id: str,
    body: ApproveLookRequest,
    current_user: User = Depends(get_current_user),
):
    """User approved one outfit. Generate avatar image and save Look to DB."""
    anchor = await WardrobeItem.get(item_id)
    if not anchor or str(anchor.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Item not found")

    outfits = body.outfits_payload.get("outfits", [])
    if body.outfit_index >= len(outfits):
        raise HTTPException(status_code=400, detail="Invalid outfit index")

    outfit = outfits[body.outfit_index]

    # Resolve wardrobe item IDs — only keep ones that actually exist in user's wardrobe
    raw_ids = outfit.get("wardrobe_item_ids", [])
    valid_ids: List[PydanticObjectId] = []
    for raw_id in raw_ids:
        try:
            item = await WardrobeItem.get(raw_id)
            if item and str(item.user_id) == str(current_user.id):
                valid_ids.append(PydanticObjectId(raw_id))
        except Exception:
            pass

    anchor_pid = PydanticObjectId(item_id)
    if anchor_pid not in valid_ids:
        valid_ids.insert(0, anchor_pid)

    # Generate avatar image (may return None if no avatar)
    fal_prompt = outfit.get("fal_prompt", "")
    avatar_url = await generate_look_avatar_image(fal_prompt, current_user.avatar)

    # Save look
    look = Look(
        user_id=current_user.id,
        anchor_item_id=anchor_pid,
        item_ids=valid_ids,
        name=outfit.get("name", ""),
        occasion=outfit.get("occasion", ""),
        season=outfit.get("season", []),
        source="styled",
        avatar_image_url=avatar_url,
        styling_notes=outfit.get("styling_notes", ""),
        claude_outfit_description=fal_prompt,
    )
    await look.insert()

    return {
        "success": True,
        "data": {
            "look_id": str(look.id),
            "avatar_image_url": avatar_url,
            "name": look.name,
            "occasion": look.occasion,
            "styling_notes": look.styling_notes,
        },
    }


@router.get("/me")
async def get_my_looks(current_user: User = Depends(get_current_user)):
    """All saved looks for the current user, newest first."""
    looks = await Look.find(Look.user_id == current_user.id).sort(-Look.created_at).to_list()
    return {"success": True, "data": [l.model_dump() for l in looks]}


@router.get("/item/{item_id}")
async def get_looks_for_item(item_id: str, current_user: User = Depends(get_current_user)):
    """All looks where anchor_item_id matches, for the item detail page."""
    try:
        anchor_pid = PydanticObjectId(item_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item ID")

    looks = await Look.find(
        Look.user_id == current_user.id,
        Look.anchor_item_id == anchor_pid,
    ).sort(-Look.created_at).to_list()
    return {"success": True, "data": [l.model_dump() for l in looks]}
