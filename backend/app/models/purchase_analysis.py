from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ScoreBreakdown(BaseModel):
    versatility: float = 0.0        # 0-10: outfit count with existing wardrobe
    style_alignment: float = 0.0    # 0-10: match with style DNA + preferences
    gap_fill: float = 0.0           # 0-10: fills wardrobe gap vs redundant
    quality: float = 0.0            # 0-10: brand research + review signals
    cost_per_outfit: float = 0.0    # 0-10: price ÷ outfit count (if price known)
    color_harmony: Optional[float] = None  # 0-10: only if user opted in to skin tone
    overall: float = 0.0            # weighted average


class OutfitCombination(BaseModel):
    name: str = ""
    items: List[str] = []           # wardrobe item IDs or descriptions
    occasion: str = ""
    styling_note: str = ""


class PurchaseAnalysis(Document):
    user_id: PydanticObjectId
    product_url: str
    product_name: str = ""
    product_image_url: str = ""
    price: Optional[float] = None
    currency: str = "USD"
    brand: str = ""
    scores: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    verdict: str = ""
    archetype: str = ""             # Curator | Explorer | Nostalgic | Trend Chaser
    archetype_note: str = ""
    style_expansion_note: str = ""
    brand_quality_note: str = ""
    outfit_count: int = 0
    outfit_combinations: List[OutfitCombination] = []
    outfit_collages: List[List[str]] = []   # list of image URL lists per outfit
    expansion_question_asked: bool = False
    expansion_answer: str = ""              # "exploring" | "impulse" | ""
    bought: Optional[bool] = None           # None = unanswered
    passed_note: str = ""                   # user note if they didn't buy
    wardrobe_item_id: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "purchase_analyses"
