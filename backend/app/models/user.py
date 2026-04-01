from beanie import Document, Indexed
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Annotated, Optional


class StylePreferences(BaseModel):
    occasions: List[str] = []
    preferred_palette: List[str] = []
    avoid: List[str] = []
    notes: str = ""


class UserPreferences(BaseModel):
    style_aesthetics: List[str] = []
    fit_preference: str = ""
    colors_to_avoid: List[str] = []
    dresses_for: List[str] = []
    climate_preference: str = ""
    stylist_notes: str = ""


class User(Document):
    email: Annotated[str, Indexed(unique=True)]
    password_hash: str
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    style_preferences: StylePreferences = Field(default_factory=StylePreferences)
    profile_picture: Optional[str] = None
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    reset_code: Optional[str] = None
    reset_code_expires: Optional[datetime] = None

    class Settings:
        name = "users"
