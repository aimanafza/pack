from beanie import Document, PydanticObjectId
from pydantic import Field, field_validator
from datetime import datetime
from typing import List
from urllib.parse import urlsplit
import re

# How pieces added from a purchase check used to record where they came from
_OLD_SOURCE_NOTE = re.compile(r"^Added from purchase analysis\. Source: (\S+)\s*$")


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
    source_url: str = ""      # the shop page it came from, for pieces added from a purchase check
    source_label: str = ""    # how to name that link, e.g. "Prada kitten heel pump"

    def with_source(self) -> "WardrobeItem":
        """Pieces added from a purchase check before source_url existed kept the shop
        link in their notes. Move it into the source fields (in memory; callers save)."""
        match = _OLD_SOURCE_NOTE.match(self.notes or "")
        if match and not self.source_url:
            url = match.group(1)
            brand = urlsplit(url).netloc.lower().removeprefix("www.").split(".")[0].capitalize()
            self.source_url = url
            self.source_label = " ".join(p for p in (brand, self.subcategory) if p) or "Original listing"
            self.notes = ""
        return self
    weight_grams: int = 300
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "wardrobe_items"
