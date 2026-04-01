from beanie import Document, PydanticObjectId
from pydantic import Field, field_validator
from datetime import datetime
from typing import List


class WardrobeItem(Document):
    user_id: PydanticObjectId
    name: str
    category: str
    subcategory: str = ""
    color: List[str] = []
    fabric: str = ""
    formality: List[str] = []

    @field_validator("formality", mode="before")
    @classmethod
    def coerce_formality(cls, v):
        # Migrate old records where formality was stored as a plain string
        if isinstance(v, str):
            return [v] if v else []
        return v or []
    occasions: List[str] = []
    season: List[str] = []
    image_url: str
    cloudinary_public_id: str
    notes: str = ""
    weight_grams: int = 300
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "wardrobe_items"
