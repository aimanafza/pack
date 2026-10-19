import base64
import hashlib
import hmac
import logging
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

WEBHOOK_TOLERANCE_SECONDS = 300


def verify_webhook_signature(
    webhook_id: str, webhook_timestamp: str, raw_body: bytes, signature_header: str
) -> bool:
    """Verify a Linq webhook per the Standard Webhooks spec (HMAC-SHA256).

    Signs "{webhook_id}.{webhook_timestamp}.{raw_body}" with the whsec_ secret
    and compares against the v1,<base64> value(s) in the signature header.
    """
    try:
        timestamp = int(webhook_timestamp)
    except (TypeError, ValueError):
        return False

    now = int(datetime.now(timezone.utc).timestamp())
    if abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS:
        return False

    secret = settings.LINQ_WEBHOOK_SECRET
    if not secret.startswith("whsec_"):
        logger.error("LINQ_WEBHOOK_SECRET missing or malformed")
        return False
    key = base64.b64decode(secret[len("whsec_"):])

    signed_content = f"{webhook_id}.{webhook_timestamp}.{raw_body.decode('utf-8')}"
    expected = base64.b64encode(
        hmac.new(key, signed_content.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")

    for candidate in signature_header.split():
        if candidate.startswith("v1,") and hmac.compare_digest(candidate[3:], expected):
            return True
    return False


async def send_message(chat_id: str, text: str) -> None:
    url = f"{settings.LINQ_API_BASE_URL}/chats/{chat_id}/messages"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.LINQ_API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={"message": {"parts": [{"type": "text", "value": text}]}},
        )
        response.raise_for_status()
