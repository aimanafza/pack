from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import List
from pymongo import IndexModel


class WeightReference(Document):
    """Typical weight for one kind of garment in one fabric, researched on the web
    once and shared by every user, so the same lookup never costs a search twice."""

    key: str                       # "<garment_type>|<fabric>", e.g. "jeans|denim"
    category: str = ""
    garment_type: str
    fabric: str = ""
    weight_grams: int
    low_grams: int = 0
    high_grams: int = 0
    sources: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "weight_references"
        indexes = [IndexModel("key", unique=True)]
