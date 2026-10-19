from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from datetime import datetime
from typing import Annotated, Optional


class ConversationState(Document):
    phone: Annotated[str, Indexed(unique=True)]
    chat_id: str
    user_id: Optional[PydanticObjectId] = None
    stage: str = "new"  # new -> awaiting_name -> awaiting_email -> awaiting_code -> active
    pending_name: Optional[str] = None
    pending_email: Optional[str] = None
    verification_code: Optional[str] = None
    verification_code_expires: Optional[datetime] = None
    code_attempts: int = 0
    opted_out: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "conversation_states"


class WebhookEvent(Document):
    """Dedupes at-least-once Linq webhook deliveries by event_id."""

    event_id: Annotated[str, Indexed(unique=True)]
    received_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "webhook_events"
