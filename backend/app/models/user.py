from beanie import Document, Indexed
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Annotated, Optional
from pymongo import ASCENDING, IndexModel
from app.models.daily import DailyStylingPrefs, StyleInsights, WornHistoryEntry


class ShoppingProfile(BaseModel):
    archetype: str = ""             # Curator | Explorer | Nostalgic | Trend Chaser
    archetype_confidence: float = 0.0
    style_expansion_intentions: List[str] = []
    impulse_ratio: float = 0.0
    total_analyses: int = 0
    total_bought: int = 0
    last_updated: Optional[datetime] = None


class UserPreferences(BaseModel):
    style_aesthetics: List[str] = []
    fit_preference: str = ""
    colors_to_avoid: List[str] = []
    dresses_for: List[str] = []
    climate_preference: str = ""
    stylist_notes: str = ""


class StyleDNA(BaseModel):
    headline: str = ""
    color_palette: List[str] = []           # hex codes
    style_keywords: List[str] = []          # 3-5 descriptors
    category_breakdown: Dict[str, int] = {} # e.g. {"Tops": 8, "Bottoms": 4}
    signature_piece_ids: List[str] = []     # wardrobe item IDs
    style_gaps: List[str] = []              # 1-3 observations
    stylist_paragraph: str = ""             # 2-3 sentence editorial description
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class AvatarAppearance(BaseModel):
    hair_color: str = ""
    hair_texture: str = ""
    hair_length: str = ""
    skin_tone: str = ""
    face_shape: str = ""
    body_silhouette: str = ""
    notable_features: str = ""
    hijab: bool = False


class AvatarFitProfile(BaseModel):
    shirt_size: str = ""
    waist_size: str = ""
    dress_size: str = ""
    height: str = ""
    inseam: str = ""


class AvatarPreferences(BaseModel):
    makeup: str = ""
    vibe: str = ""
    features_to_preserve: List[str] = []


class Avatar(BaseModel):
    base_url: str = ""
    variation_urls: List[str] = []
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    generation_prompt: str = ""
    fit_profile: AvatarFitProfile = Field(default_factory=AvatarFitProfile)
    appearance: AvatarAppearance = Field(default_factory=AvatarAppearance)
    preferences: AvatarPreferences = Field(default_factory=AvatarPreferences)


class User(Document):
    email: Annotated[str, Indexed(unique=True)]
    password_hash: Optional[str] = None
    name: str
    phone: Optional[str] = None
    phone_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    profile_picture: Optional[str] = None
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    style_dna: Optional[StyleDNA] = None
    avatar: Optional[Avatar] = None
    reset_code: Optional[str] = None
    reset_code_expires: Optional[datetime] = None
    login_code: Optional[str] = None
    login_code_expires: Optional[datetime] = None
    login_code_attempts: int = 0
    dashboard_carpet_url: Optional[str] = None
    daily_styling_prefs: DailyStylingPrefs = Field(default_factory=DailyStylingPrefs)
    style_insights: StyleInsights = Field(default_factory=StyleInsights)
    worn_history: List[WornHistoryEntry] = Field(default_factory=list)
    shopping_profile: ShoppingProfile = Field(default_factory=ShoppingProfile)
    extension_connected: bool = False

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("phone", ASCENDING)], unique=True, sparse=True, name="phone_unique_sparse"),
        ]
