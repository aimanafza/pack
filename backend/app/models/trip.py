from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import List, Optional


class ReservedItem(BaseModel):
    name: str
    weight_grams: int = 0


class BagEntry(BaseModel):
    bag_id: str
    bag_type: str  # carry_on | checked | handbag | backpack
    label: str
    weight_limit_grams: int
    empty_bag_weight_grams: int
    available_grams: int  # computed: limit - empty


class PackingItem(BaseModel):
    wardrobe_item_id: Optional[str] = None
    name: str
    category: str
    image_url: Optional[str] = None
    checked: bool = False
    in_wardrobe: bool = False


class Outfit(BaseModel):
    name: str
    occasion: str
    items: List[PackingItem] = []
    styling_note: str = ""


class PackingList(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    stylist_note: str = ""
    outfits: List[Outfit] = []
    essentials: List[str] = []
    raw_items: List[PackingItem] = []


class InspirationImage(BaseModel):
    url: str
    cloudinary_public_id: str


class VibeAnalysis(BaseModel):
    summary: str
    style_keywords: List[str] = []
    color_palette: List[str] = []
    formality_level: str = ""
    avoid: List[str] = []
    raw_analysis: str = ""


class Trip(Document):
    user_id: PydanticObjectId
    name: str
    destination: str
    start_date: date
    end_date: date
    duration_days: int
    occasions: List[str] = []
    climate: str = ""
    notes: str = ""
    inspiration_images: List[InspirationImage] = []
    vibe_analysis: Optional[VibeAnalysis] = None
    packing_list: Optional[PackingList] = None
    approved_outfits: List[str] = []
    rejected_outfits: List[str] = []
    bags: List[BagEntry] = []
    reserved_items: List[ReservedItem] = []
    available_clothing_weight_grams: int = 0
    weight_unit: str = "kg"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "planning"

    class Settings:
        name = "trips"
