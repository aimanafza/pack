from datetime import datetime
from typing import List, Optional

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import IndexModel


class DraftFields(BaseModel):
    """What the add-item form holds, filled in by Claude and edited by the user."""

    name: str = ""
    category: str = ""
    subcategory: str = ""
    color: List[str] = []
    fabric: str = ""
    formality: List[str] = []
    occasions: List[str] = []
    season: List[str] = []
    notes: str = ""
    weight_grams: int = 0


class WardrobeDraft(Document):
    """One photo from a bulk upload, waiting for the user to review it.

    Life of a draft: queued -> reading -> ready (or failed: the user fills it in),
    then on confirm: saving -> saved (or save_failed). The photo sits in a temporary
    Cloudinary folder until the item is saved or the draft is discarded."""

    user_id: PydanticObjectId
    batch_id: str
    status: str = "queued"
    image_url: str
    image_public_id: str
    fields: DraftFields = Field(default_factory=DraftFields)
    error: str = ""
    item_id: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "wardrobe_drafts"
        indexes = [
            IndexModel([("user_id", 1), ("batch_id", 1)]),
            IndexModel([("user_id", 1), ("status", 1)]),
        ]
