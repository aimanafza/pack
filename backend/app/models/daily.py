from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import List, Optional
from beanie import PydanticObjectId


class DailyOutfit(BaseModel):
    outfit_index: int
    item_ids: List[str] = []
    item_names: List[str] = []
    item_image_urls: List[str] = []
    claude_note: str = ""
    occasion_tags: List[str] = []


class DailyStylingPrefs(BaseModel):
    notification_time: str = "07:30"
    notifications_enabled: bool = False
    calendar_connected: bool = False
    calendar_provider: Optional[str] = None


class StyleInsights(BaseModel):
    last_updated: Optional[datetime] = None
    underused_item_ids: List[str] = []
    skip_pattern_item_ids: List[str] = []
    occasion_preferences: dict = {}
    vibe_correlations: dict = {}
    wear_frequency: dict = {}


class WornHistoryEntry(BaseModel):
    date: str  # ISO date string "YYYY-MM-DD"
    look_id: str
    occasion: str
    vibe: Optional[str] = None
    item_ids: List[str] = []
    weather_summary: str = ""


class DailyLook(Document):
    user_id: PydanticObjectId
    date: str  # ISO date string "YYYY-MM-DD"
    occasion: str
    mood: str
    vibe: Optional[str] = None
    weather_summary: str = ""
    generated_outfits: List[DailyOutfit] = []
    chosen_outfit_index: Optional[int] = None
    chosen_item_ids: List[str] = []
    status: str = "generated"  # "generated" | "chosen" | "skipped"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "daily_looks"
