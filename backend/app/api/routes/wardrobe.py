from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel
from typing import List, Optional
from app.models.user import User
from app.models.item import WardrobeItem
from app.api.deps import get_current_user
from app.services.cloudinary_service import upload_wardrobe_item, delete_wardrobe_item
from app.services.claude_service import regenerate_style_dna_for_user
import json

router = APIRouter()


class ItemUpdateBody(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    color: Optional[List[str]] = None
    fabric: Optional[str] = None
    formality: Optional[List[str]] = None
    occasions: Optional[List[str]] = None
    season: Optional[List[str]] = None
    notes: Optional[str] = None
    weight_grams: Optional[int] = None


@router.get("/")
async def get_wardrobe(current_user: User = Depends(get_current_user)):
    items = await WardrobeItem.find(WardrobeItem.user_id == current_user.id).to_list()
    return {"success": True, "data": [item.model_dump() for item in items], "message": ""}


@router.post("/")
async def add_item(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    category: str = Form(...),
    subcategory: str = Form(""),
    color: str = Form("[]"),
    fabric: str = Form(""),
    formality: str = Form("[]"),
    occasions: str = Form("[]"),
    season: str = Form("[]"),
    notes: str = Form(""),
    weight_grams: int = Form(300),
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    image_data = await image.read()
    upload_result = await upload_wardrobe_item(image_data, str(current_user.id))

    item = WardrobeItem(
        user_id=current_user.id,
        name=name,
        category=category,
        subcategory=subcategory,
        color=json.loads(color),
        fabric=fabric,
        formality=json.loads(formality),
        occasions=json.loads(occasions),
        season=json.loads(season),
        notes=notes,
        weight_grams=weight_grams,
        image_url=upload_result["url"],
        cloudinary_public_id=upload_result["public_id"],
    )
    await item.insert()
    # TODO: auto-regenerate style DNA on wardrobe change (re-enable later)
    # background_tasks.add_task(regenerate_style_dna_for_user, str(current_user.id))
    return {"success": True, "data": item.model_dump(), "message": "Item added"}


@router.get("/{item_id}")
async def get_item(item_id: str, current_user: User = Depends(get_current_user)):
    item = await WardrobeItem.get(item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "data": item.model_dump(), "message": ""}


@router.put("/{item_id}")
async def update_item(item_id: str, body: ItemUpdateBody, current_user: User = Depends(get_current_user)):
    item = await WardrobeItem.get(item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    updates = body.model_dump(exclude_none=True)
    if updates:
        await item.set(updates)
    return {"success": True, "data": item.model_dump(), "message": "Item updated"}


@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    item = await WardrobeItem.get(item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    await delete_wardrobe_item(item.cloudinary_public_id)
    await item.delete()
    # TODO: auto-regenerate style DNA on wardrobe change (re-enable later)
    # background_tasks.add_task(regenerate_style_dna_for_user, str(current_user.id))
    return {"success": True, "data": None, "message": "Item deleted"}
