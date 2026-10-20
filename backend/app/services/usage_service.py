"""Monthly upload allowance: reserve a slot before doing the costly work, give it back
if the work fails. Reserving is one atomic database update, so two uploads at once
can never both take the last slot."""

from datetime import datetime
from typing import Literal

from pymongo.errors import DuplicateKeyError

from app.core.plans import limits_for
from app.models.upload_usage import UploadUsage

Kind = Literal["items_added", "photos_read"]
_LIMIT_KEY = {"items_added": "items_per_month", "photos_read": "photo_reads_per_month"}


def current_month(now: datetime = None) -> str:
    return (now or datetime.utcnow()).strftime("%Y-%m")


def next_reset(now: datetime = None) -> datetime:
    now = now or datetime.utcnow()
    return datetime(now.year + 1, 1, 1) if now.month == 12 else datetime(now.year, now.month + 1, 1)


def reset_label(now: datetime = None) -> str:
    """'November 1': how the reset date reads in messages."""
    reset = next_reset(now)
    return f"{reset.strftime('%B')} {reset.day}"


async def _ensure_row(user_id, month: str) -> None:
    try:
        await UploadUsage.get_motor_collection().update_one(
            {"user_id": user_id, "month": month},
            {"$setOnInsert": {"items_added": 0, "photos_read": 0}},
            upsert=True,
        )
    except DuplicateKeyError:
        pass  # another request created it a moment ago


async def reserve(user, kind: Kind, count: int = 1) -> bool:
    """Take `count` slots if they're all available. False means the user is at the limit."""
    limit = limits_for(user)[_LIMIT_KEY[kind]]
    if count > limit:
        return False
    month = current_month()
    await _ensure_row(user.id, month)
    result = await UploadUsage.get_motor_collection().update_one(
        {"user_id": user.id, "month": month, kind: {"$lte": limit - count}},
        {"$inc": {kind: count}},
    )
    return result.modified_count == 1


async def release(user, kind: Kind, count: int = 1) -> None:
    """Give back slots for work that didn't happen (a failed upload or read)."""
    await UploadUsage.get_motor_collection().update_one(
        {"user_id": user.id, "month": current_month(), kind: {"$gte": count}},
        {"$inc": {kind: -count}},
    )


async def summary(user) -> dict:
    limits = limits_for(user)
    row = await UploadUsage.find_one(UploadUsage.user_id == user.id, UploadUsage.month == current_month())
    items_used = row.items_added if row else 0
    reads_used = row.photos_read if row else 0
    items_left = max(0, limits["items_per_month"] - items_used)
    reads_left = max(0, limits["photo_reads_per_month"] - reads_used)
    return {
        "items": {"used": items_used, "limit": limits["items_per_month"], "left": items_left},
        "photo_reads": {"used": reads_used, "limit": limits["photo_reads_per_month"], "left": reads_left},
        # Bulk upload can't take more photos than either allowance has left
        "batch_max": min(limits["photos_per_batch"], items_left, reads_left),
        "resets_on": next_reset().date().isoformat(),
        "resets_label": reset_label(),
    }


def items_limit_message(user) -> str:
    limit = limits_for(user)["items_per_month"]
    return f"You've added {limit} new items this month. You can add more on {reset_label()}."


def reads_limit_message(user) -> str:
    limit = limits_for(user)["photo_reads_per_month"]
    return (
        f"Autofill has read {limit} photos for you this month. You can still fill in the details "
        f"yourself, and autofill comes back on {reset_label()}."
    )
