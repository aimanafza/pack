from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel
from typing import List, Literal, Optional
from beanie import PydanticObjectId
from beanie.operators import In
from app.models.user import User
from app.models.item import WardrobeItem
from app.api.deps import get_current_user
from app.services.cloudinary_service import upload_wardrobe_item, delete_wardrobe_item
from app.services.claude_service import regenerate_style_dna_for_user, analyse_wardrobe_item_image
from app.services import usage_service
import json
import logging

logger = logging.getLogger(__name__)

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
    # Newest first, so freshly added pieces are at the top of the wardrobe
    items = await WardrobeItem.find(WardrobeItem.user_id == current_user.id).sort(-WardrobeItem.created_at).to_list()
    return {"success": True, "data": [item.with_source().model_dump() for item in items], "message": ""}


@router.get("/usage")
async def get_upload_usage(current_user: User = Depends(get_current_user)):
    """How many new items and autofill reads are left this month."""
    return {"success": True, "data": await usage_service.summary(current_user), "message": ""}


@router.post("/analyse-image")
async def analyse_wardrobe_image(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Analyse an already-uploaded image and return autofill metadata."""
    image_url = body.get("image_url")
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url required")
    # No point reading a photo that can't be saved this month
    usage = await usage_service.summary(current_user)
    if usage["items"]["left"] == 0:
        raise HTTPException(status_code=429, detail=usage_service.items_limit_message(current_user))
    if not await usage_service.reserve(current_user, "photos_read"):
        raise HTTPException(status_code=429, detail=usage_service.reads_limit_message(current_user))
    result = await analyse_wardrobe_item_image(image_url)
    if not result:
        # The read failed, so it shouldn't count
        await usage_service.release(current_user, "photos_read")
    return {"success": True, "data": result}


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
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    temp_public_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    if not await usage_service.reserve(current_user, "items_added"):
        raise HTTPException(status_code=429, detail=usage_service.items_limit_message(current_user))

    # If image was pre-uploaded (AI autofill flow), re-run it through the
    # wardrobe pipeline so background removal and proper folder/naming are applied.
    try:
        if image_url:
            upload_result = await upload_wardrobe_item(image_url, str(current_user.id))
        elif image:
            image_data = await image.read()
            upload_result = await upload_wardrobe_item(image_data, str(current_user.id))
        else:
            raise HTTPException(status_code=400, detail="Either image file or image_url required")
    except HTTPException:
        await usage_service.release(current_user, "items_added")
        raise
    except Exception as e:
        await usage_service.release(current_user, "items_added")
        logger.error(f"Wardrobe upload failed for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="We couldn't upload that photo. Try again in a moment.")

    url = upload_result["url"]
    public_id = upload_result["public_id"]

    # The pre-upload Claude read from is a temporary copy: delete it now the real one exists.
    # Only this user's own uploads folder, so the id can't point anywhere else.
    if temp_public_id and temp_public_id.startswith(f"pack/inspiration/{current_user.id}/"):
        background_tasks.add_task(_delete_images, [temp_public_id])

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
        image_url=url,
        cloudinary_public_id=public_id,
    )
    await item.insert()
    # background_tasks.add_task(regenerate_style_dna_for_user, str(current_user.id))
    return {"success": True, "data": item.model_dump(), "message": "Item added"}


class BulkItemsBody(BaseModel):
    item_ids: List[str]


class BulkCategoryBody(BaseModel):
    item_ids: List[str]
    category: Literal["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"]


def _object_ids(item_ids: List[str]) -> List[PydanticObjectId]:
    try:
        return [PydanticObjectId(i) for i in item_ids]
    except Exception:
        raise HTTPException(status_code=400, detail="Some of those items couldn't be found. Refresh and try again.")


async def _delete_images(public_ids: List[str]) -> None:
    for public_id in public_ids:
        try:
            await delete_wardrobe_item(public_id)
        except Exception:
            logger.exception("Couldn't delete wardrobe image %s", public_id)


# Bulk routes sit above /{item_id} so their paths are never read as an item id
@router.post("/bulk-delete")
async def bulk_delete_items(
    body: BulkItemsBody,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    ids = _object_ids(body.item_ids)
    if not ids:
        return {"success": True, "data": {"deleted": 0}, "message": "Nothing to delete"}
    owned = WardrobeItem.find(In(WardrobeItem.id, ids), WardrobeItem.user_id == current_user.id)
    items = await owned.to_list()
    await owned.delete()
    # Images go after the response; the items are already gone from the wardrobe
    background_tasks.add_task(_delete_images, [i.cloudinary_public_id for i in items if i.cloudinary_public_id])
    return {"success": True, "data": {"deleted": len(items)}, "message": f"Deleted {len(items)} items"}


@router.patch("/bulk-category")
async def bulk_move_items(body: BulkCategoryBody, current_user: User = Depends(get_current_user)):
    ids = _object_ids(body.item_ids)
    if not ids:
        return {"success": True, "data": {"updated": 0}, "message": "Nothing to move"}
    result = await WardrobeItem.find(
        In(WardrobeItem.id, ids), WardrobeItem.user_id == current_user.id
    ).update({"$set": {"category": body.category}})
    updated = getattr(result, "modified_count", 0)
    return {"success": True, "data": {"updated": updated}, "message": f"Moved {updated} items"}


@router.get("/{item_id}")
async def get_item(item_id: str, current_user: User = Depends(get_current_user)):
    item = await WardrobeItem.get(item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "data": item.with_source().model_dump(), "message": ""}


@router.put("/{item_id}")
async def update_item(item_id: str, body: ItemUpdateBody, current_user: User = Depends(get_current_user)):
    item = await WardrobeItem.get(item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    updates = body.model_dump(exclude_none=True)
    # An edit saves the upgraded source too, so an old shop link survives new notes
    item.with_source()
    updates = {"source_url": item.source_url, "source_label": item.source_label, "notes": item.notes, **updates}
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
