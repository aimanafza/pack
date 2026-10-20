"""Bulk upload: photos go up one at a time into a batch, Claude reads each in the
background, and the review screen polls the drafts until they're ready."""

import logging
import re
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from app.api.deps import get_current_user
from app.core.plans import limits_for
from app.models.user import User
from app.models.wardrobe_draft import WardrobeDraft
from app.services import draft_service, usage_service
from app.services.cloudinary_service import upload_draft_photo

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_PHOTO_BYTES = 10 * 1024 * 1024  # Cloudinary's free plan limit per image
_BATCH_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


def _draft_out(draft: WardrobeDraft) -> dict:
    data = draft.model_dump(exclude={"user_id"})
    data["id"] = str(draft.id)
    data["item_id"] = str(draft.item_id) if draft.item_id else None
    return data


async def _own_draft(draft_id: str, user: User) -> WardrobeDraft:
    try:
        draft = await WardrobeDraft.get(PydanticObjectId(draft_id))
    except Exception:
        draft = None
    if not draft or draft.user_id != user.id:
        raise HTTPException(status_code=404, detail="That photo isn't in your uploads anymore.")
    return draft


@router.post("/")
async def add_draft_photo(
    background_tasks: BackgroundTasks,
    batch_id: str = Form(...),
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not _BATCH_ID.match(batch_id):
        raise HTTPException(status_code=400, detail="Start a new upload and try again.")
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="That file isn't a photo. Choose a JPG, PNG or HEIC image.")
    data = await image.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="That photo is over 10 MB. Choose a smaller one.")

    # A batch holds at most what the plan allows, and never more than can be saved this month
    in_batch = await WardrobeDraft.find(
        WardrobeDraft.user_id == current_user.id, WardrobeDraft.batch_id == batch_id
    ).count()
    per_batch = limits_for(current_user)["photos_per_batch"]
    if in_batch >= per_batch:
        raise HTTPException(status_code=400, detail=f"One upload can hold up to {per_batch} photos.")
    usage = await usage_service.summary(current_user)
    if in_batch >= usage["items"]["left"]:
        raise HTTPException(status_code=429, detail=usage_service.items_limit_message(current_user))
    if not await usage_service.reserve(current_user, "photos_read"):
        raise HTTPException(status_code=429, detail=usage_service.reads_limit_message(current_user))

    try:
        stored = await upload_draft_photo(data, str(current_user.id))
    except Exception:
        await usage_service.release(current_user, "photos_read")
        logger.exception("Draft photo upload failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail="We couldn't upload that photo. Try again in a moment.")

    draft = WardrobeDraft(
        user_id=current_user.id,
        batch_id=batch_id,
        image_url=stored["url"],
        image_public_id=stored["public_id"],
    )
    await draft.insert()
    background_tasks.add_task(draft_service.read_draft, draft.id)
    return {"success": True, "data": _draft_out(draft), "message": ""}


@router.get("/")
async def list_drafts(
    background_tasks: BackgroundTasks,
    batch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """The review screen polls this. Without a batch_id it returns every unsaved draft,
    which is how the wardrobe knows to say "Your items are ready to review"."""
    await draft_service.sweep_expired(current_user.id)
    for draft_id in await draft_service.requeue_stale(current_user.id):
        background_tasks.add_task(draft_service.read_draft, draft_id)

    query = [WardrobeDraft.user_id == current_user.id]
    if batch_id:
        query.append(WardrobeDraft.batch_id == batch_id)
    else:
        query.append({"status": {"$ne": "saved"}})
    drafts = await WardrobeDraft.find(*query).sort("created_at").to_list()
    return {"success": True, "data": [_draft_out(d) for d in drafts], "message": ""}


@router.delete("/{draft_id}")
async def discard_draft(draft_id: str, current_user: User = Depends(get_current_user)):
    """Remove one photo from the batch. Its read still counts; Claude already did the work."""
    draft = await _own_draft(draft_id, current_user)
    if draft.status in ("saving", "saved"):
        raise HTTPException(status_code=409, detail="That item is already being added to your wardrobe.")
    await draft_service.discard(draft)
    return {"success": True, "data": None, "message": "Removed"}
