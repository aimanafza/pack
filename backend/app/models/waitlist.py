from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class WaitlistEntry(Document):
    email: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    invite_token: Optional[str] = None
    token_used: bool = False

    class Settings:
        name = "waitlist"
