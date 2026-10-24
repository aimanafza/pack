"""Bulk upload drafts: Claude reads each photo in the background and fills in its fields.

Reads are capped server-wide by a semaphore so a few big batches can't flood Claude or
the event loop. If the server restarts mid-batch, drafts left half-read are picked up
again the next time the review screen asks for them (requeue_stale)."""

import asyncio
import logging
from datetime import datetime, timedelta

from app.models.user import User
from app.models.wardrobe_draft import DraftFields, WardrobeDraft
from app.services import usage_service
from app.services.claude_service import analyse_wardrobe_item_image
from app.models.item import WardrobeItem
from app.services.cloudinary_service import delete_wardrobe_item, upload_wardrobe_item
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger(__name__)

READ_CONCURRENCY = 6
SAVE_CONCURRENCY = 4                 # background removals at once
STALE_AFTER = timedelta(minutes=3)   # a read that's been "in progress" this long died with the server
DRAFT_TTL = timedelta(days=7)        # unconfirmed drafts are cleared after a week

_read_slots = asyncio.Semaphore(READ_CONCURRENCY)
_save_slots = asyncio.Semaphore(SAVE_CONCURRENCY)

# The add-item form's options; Claude's answers are matched to these
CATEGORIES = ["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"]
FABRICS = ["linen", "cotton", "silk", "wool", "synthetic", "denim", "leather", "other"]
FORMALITIES = ["casual", "smart-casual", "elevated casual", "business casual", "business", "formal"]
OCCASIONS = ["work", "casual", "formal", "travel", "dinner", "beach", "hiking", "nightlife"]
SEASONS = ["spring", "summer", "fall", "winter", "all"]

READ_FAILED_MESSAGE = "We couldn't read this photo. Fill in the details yourself."
SAVE_FAILED_MESSAGE = "This one didn't make it into your wardrobe. Add it again to retry."


def missing_field(fields: DraftFields) -> str:
    """Same rules as the add-item form: what's still needed before saving, or ''."""
    if not fields.name.strip():
        return "name"
    if not fields.category:
        return "category"
    if not fields.color:
        return "color"
    if not fields.fabric:
        return "fabric"
    if not fields.formality:
        return "dress code"
    if not fields.occasions:
        return "occasion"
    if not fields.season:
        return "season"
    return ""


def _norm(value) -> str:
    # "Smart-Casual", "smart casual" and "smart-casual" all compare equal
    return str(value or "").lower().replace("-", " ").strip()


def _match(value, allowed: list) -> str:
    wanted = _norm(value)
    return next((option for option in allowed if _norm(option) == wanted), "")


def _match_list(values, allowed: list) -> list:
    matched = [_match(v, allowed) for v in (values if isinstance(values, list) else [])]
    return list(dict.fromkeys(m for m in matched if m))  # drop blanks and repeats, keep order


def fields_from_analysis(result: dict) -> DraftFields:
    weight = result.get("weight_grams")
    return DraftFields(
        name=str(result.get("name") or "").strip(),
        category=_match(result.get("category"), CATEGORIES),
        subcategory=str(result.get("subcategory") or "").strip(),
        color=[str(c).lower().strip() for c in (result.get("color") or []) if str(c).strip()],
        fabric=_match(result.get("fabric"), FABRICS),
        formality=_match_list(result.get("formality"), FORMALITIES),
        occasions=_match_list(result.get("occasions"), OCCASIONS),
        season=_match_list(result.get("season"), SEASONS),
        notes=str(result.get("notes") or "").strip(),
        weight_grams=weight if isinstance(weight, int) and weight > 0 else 0,
    )


async def read_draft(draft_id) -> None:
    """Let Claude fill in one draft. Safe to call twice: it only reads queued drafts."""
    async with _read_slots:
        draft = await WardrobeDraft.get(draft_id)
        if not draft or draft.status not in ("queued", "reading"):
            return
        await draft.set({"status": "reading", "updated_at": datetime.utcnow()})
        try:
            result = await analyse_wardrobe_item_image(draft.image_url)
        except Exception:
            logger.exception("Draft read crashed for %s", draft_id)
            result = {}

        if result:
            await draft.set({
                "status": "ready",
                "fields": fields_from_analysis(result).model_dump(),
                "error": "",
                "updated_at": datetime.utcnow(),
            })
            return

        await draft.set({"status": "failed", "error": READ_FAILED_MESSAGE, "updated_at": datetime.utcnow()})
        # Nothing was read, so it shouldn't count against the month
        user = await User.get(draft.user_id)
        if user:
            await usage_service.release(user, "photos_read")


async def requeue_stale(user_id) -> list:
    """Drafts stuck mid-read (the server restarted) go back in the queue. Returns their ids."""
    cutoff = datetime.utcnow() - STALE_AFTER
    stuck = await WardrobeDraft.find(
        WardrobeDraft.user_id == user_id,
        {"status": {"$in": ["queued", "reading"]}},
        WardrobeDraft.updated_at < cutoff,
    ).to_list()
    for draft in stuck:
        await draft.set({"status": "queued", "updated_at": datetime.utcnow()})
    return [d.id for d in stuck]


async def stale_saves(user_id) -> list:
    """Drafts stuck mid-save (the server restarted). Saving again is safe; see save_draft."""
    cutoff = datetime.utcnow() - STALE_AFTER
    stuck = await WardrobeDraft.find(
        WardrobeDraft.user_id == user_id,
        WardrobeDraft.status == "saving",
        WardrobeDraft.updated_at < cutoff,
    ).to_list()
    for draft in stuck:
        await draft.set({"updated_at": datetime.utcnow()})
    return [d.id for d in stuck]


async def save_draft(draft_id) -> None:
    """Turn a confirmed draft into a wardrobe item, background removed.

    The item reuses the draft's id, so running this twice for one draft (after a
    restart) finds the item already there instead of creating a duplicate. Its monthly
    slot was reserved at confirm; a failed save gives it back."""
    async with _save_slots:
        draft = await WardrobeDraft.get(draft_id)
        if not draft or draft.status != "saving":
            return

        if not await WardrobeItem.get(draft.id):
            try:
                stored = await upload_wardrobe_item(draft.image_url, str(draft.user_id))
            except Exception:
                logger.exception("Saving draft %s failed", draft_id)
                await draft.set({"status": "save_failed", "error": SAVE_FAILED_MESSAGE, "updated_at": datetime.utcnow()})
                user = await User.get(draft.user_id)
                if user:
                    await usage_service.release(user, "items_added")
                return

            f = draft.fields
            item = WardrobeItem(
                id=draft.id,
                user_id=draft.user_id,
                name=f.name.strip(),
                category=f.category,
                subcategory=f.subcategory,
                color=f.color,
                fabric=f.fabric,
                formality=f.formality,
                occasions=f.occasions,
                season=f.season,
                notes=f.notes,
                weight_grams=f.weight_grams or 300,
                image_url=stored["url"],
                cloudinary_public_id=stored["public_id"],
            )
            try:
                await item.insert()
            except DuplicateKeyError:
                # Another run saved it first; drop the extra photo this run uploaded
                await delete_wardrobe_item(stored["public_id"])

        try:
            await delete_wardrobe_item(draft.image_public_id)
        except Exception:
            logger.exception("Couldn't delete draft photo %s", draft.image_public_id)
        await draft.set({"status": "saved", "item_id": draft.id, "error": "", "updated_at": datetime.utcnow()})


async def sweep_expired(user_id) -> None:
    """Clear drafts nobody confirmed within a week, photos included."""
    cutoff = datetime.utcnow() - DRAFT_TTL
    old = await WardrobeDraft.find(
        WardrobeDraft.user_id == user_id,
        WardrobeDraft.created_at < cutoff,
        {"status": {"$nin": ["saving"]}},
    ).to_list()
    for draft in old:
        await discard(draft)


async def discard(draft: WardrobeDraft) -> None:
    if draft.status not in ("saved",):
        try:
            await delete_wardrobe_item(draft.image_public_id)
        except Exception:
            logger.exception("Couldn't delete draft photo %s", draft.image_public_id)
    await draft.delete()
