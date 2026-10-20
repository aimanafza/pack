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
from app.services.cloudinary_service import delete_wardrobe_item

logger = logging.getLogger(__name__)

READ_CONCURRENCY = 6
STALE_AFTER = timedelta(minutes=3)   # a read that's been "in progress" this long died with the server
DRAFT_TTL = timedelta(days=7)        # unconfirmed drafts are cleared after a week

_read_slots = asyncio.Semaphore(READ_CONCURRENCY)

# The add-item form's options; Claude's answers are matched to these
CATEGORIES = ["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"]
FABRICS = ["linen", "cotton", "silk", "wool", "synthetic", "denim", "leather", "other"]
FORMALITIES = ["casual", "smart-casual", "elevated casual", "business casual", "business", "formal"]
OCCASIONS = ["work", "casual", "formal", "travel", "dinner", "beach", "hiking", "nightlife"]
SEASONS = ["spring", "summer", "fall", "winter", "all"]

READ_FAILED_MESSAGE = "We couldn't read this photo. Fill in the details yourself."


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
