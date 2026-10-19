import logging
import random
import re
import string
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from app.models.conversation import ConversationState, WebhookEvent
from app.models.user import User
from app.services import linq_service
from app.services.email import send_phone_verification_email
from app.services.transcription_service import transcribe_voice_note

logger = logging.getLogger(__name__)

router = APIRouter()

CODE_EXPIRE_MINUTES = 15
CODE_MAX_ATTEMPTS = 5
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

STAGE_REPROMPTS = {
    "awaiting_name": "Let's finish getting you set up first — what's your name?",
    "awaiting_email": "One sec — I still need your email to finish setting you up.",
    "awaiting_code": "I need that 6-digit code first — check your email, or text 'resend' for a new one.",
}

STOP_KEYWORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit"}
START_KEYWORDS = {"start", "unstop"}


def _extract_text(parts: list) -> str:
    return "\n".join(
        p.get("value", "") for p in parts if p.get("type") == "text"
    ).strip()


def _extract_audio_parts(parts: list) -> list:
    return [
        p for p in parts
        if p.get("type") == "media" and (p.get("mime_type") or "").startswith("audio/")
    ]


def _has_image_media(parts: list) -> bool:
    return any(
        p.get("type") == "media" and (p.get("mime_type") or "").startswith("image/")
        for p in parts
    )


async def _transcribe_first_audio(part: dict, phone: str) -> Optional[str]:
    """Download + transcribe one audio part. Returns None on any failure
    (download, conversion, or transcription) — caller decides what to tell the user."""
    url = part.get("url")
    mime_type = part.get("mime_type", "")
    if not url:
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            audio_bytes = response.content
    except Exception:
        logger.exception("Failed to download voice note from Linq for %s", phone)
        return None

    try:
        transcript = await transcribe_voice_note(audio_bytes, mime_type)
    except Exception:
        logger.exception("Failed to transcribe voice note for %s (mime_type=%s)", phone, mime_type)
        return None

    logger.info("Voice note transcribed for %s — mime_type=%s transcript=%r", phone, mime_type, transcript)
    return transcript


def _new_code() -> str:
    return "".join(random.choices(string.digits, k=6))


async def _get_or_create_state(phone: str, chat_id: str) -> ConversationState:
    state = await ConversationState.find_one(ConversationState.phone == phone)
    if not state:
        state = ConversationState(phone=phone, chat_id=chat_id)
        await state.insert()
    elif state.chat_id != chat_id:
        state.chat_id = chat_id
        await state.save()
    return state


async def _send_code(state: ConversationState) -> bool:
    """Generate + persist a new code, email it, and report whether the email actually sent."""
    code = _new_code()
    state.verification_code = code
    state.verification_code_expires = datetime.utcnow() + timedelta(minutes=CODE_EXPIRE_MINUTES)
    state.code_attempts = 0
    state.stage = "awaiting_code"
    state.updated_at = datetime.utcnow()
    await state.save()
    try:
        send_phone_verification_email(state.pending_email, code)
        return True
    except Exception:
        logger.exception("Failed to send verification email to %s", state.pending_email)
        return False


async def _handle_onboarding(state: ConversationState, text: str) -> str:
    stage = state.stage

    if stage == "new":
        state.stage = "awaiting_name"
        state.updated_at = datetime.utcnow()
        await state.save()
        return "Hey, I'm Pack — your personal stylist, right here in iMessage. What's your name?"

    if stage == "awaiting_name":
        name = text.strip()
        if not name:
            return "Didn't catch that — what's your name?"
        state.pending_name = name[:100]
        state.stage = "awaiting_email"
        state.updated_at = datetime.utcnow()
        await state.save()
        return f"Good to meet you, {state.pending_name}. What's your email?"

    if stage == "awaiting_email":
        match = EMAIL_RE.search(text)
        if not match:
            return "That doesn't look like an email — what's your email?"
        state.pending_email = match.group(0).lower()
        if not await _send_code(state):
            return "That email didn't go through on my end — double check it and text it again, or try 'resend'."
        return "Sent you a 6-digit code — text it back here to confirm it's you."

    if stage == "awaiting_code":
        if text.strip().lower() == "resend":
            if not await _send_code(state):
                return "Couldn't send that code — give it a moment and text 'resend' again."
            return "Sent you a new code — text it back here."

        expired = (
            not state.verification_code
            or not state.verification_code_expires
            or datetime.utcnow() > state.verification_code_expires
        )
        if expired:
            return "That code's expired — text 'resend' for a new one."

        submitted = "".join(ch for ch in text if ch.isdigit())
        if not submitted or submitted != state.verification_code:
            state.code_attempts += 1
            state.updated_at = datetime.utcnow()
            if state.code_attempts >= CODE_MAX_ATTEMPTS:
                state.verification_code = None
                state.verification_code_expires = None
                await state.save()
                return "That's 5 wrong tries — text 'resend' for a new code."
            await state.save()
            remaining = CODE_MAX_ATTEMPTS - state.code_attempts
            plural = "" if remaining == 1 else "s"
            return f"That code doesn't match — check your email and try again ({remaining} attempt{plural} left)."

        existing_user = await User.find_one(User.email == state.pending_email)
        if existing_user:
            existing_user.phone = state.phone
            existing_user.phone_verified = True
            await existing_user.save()
            user = existing_user
            reply = f"Found your Pack account, {user.name} — you're all set."
        else:
            user = User(
                email=state.pending_email,
                name=state.pending_name or "",
                password_hash=None,
                phone=state.phone,
                phone_verified=True,
            )
            await user.insert()
            reply = f"You're in, {user.name}. That's onboarding done."

        state.user_id = user.id
        state.stage = "active"
        state.verification_code = None
        state.verification_code_expires = None
        state.code_attempts = 0
        state.updated_at = datetime.utcnow()
        await state.save()
        return reply

    # active — wardrobe/outfit conversation logic lands in a later step
    return "You're all set up — outfit help is coming soon."


async def _process_event(event: dict) -> None:
    data = event.get("data", {})
    if data.get("is_from_me"):
        return

    message = data.get("message", {})
    parts = message.get("parts", [])
    text = _extract_text(parts)
    audio_parts = _extract_audio_parts(parts)
    has_image = _has_image_media(parts)
    if not text and not audio_parts and not has_image:
        return

    phone = data.get("from")
    chat_id = data.get("chat_id")
    if not phone or not chat_id:
        logger.warning("iMessage webhook event missing from/chat_id, skipping")
        return

    state = await _get_or_create_state(phone, chat_id)

    try:
        # Transcribe first, before anything else reads `text` — a voice note
        # becomes an ordinary text message from here on, so STOP/START and
        # every onboarding stage handle it exactly like something typed.
        if not text and audio_parts:
            transcript = await _transcribe_first_audio(audio_parts[0], phone)
            if transcript is None:
                await linq_service.send_message(chat_id, "Couldn't catch that one, mind typing it?")
                return
            text = transcript

        normalized = text.strip().lower() if text else ""

        if state.opted_out:
            if normalized in START_KEYWORDS:
                state.opted_out = False
                state.updated_at = datetime.utcnow()
                await state.save()
                await linq_service.send_message(chat_id, "You're resubscribed to Pack. Text 'hey Pack' to pick back up.")
            # Opted out and not a resubscribe keyword: stay silent, no reply at all.
            return

        if normalized in STOP_KEYWORDS:
            state.opted_out = True
            state.updated_at = datetime.utcnow()
            await state.save()
            await linq_service.send_message(chat_id, "You've been unsubscribed from Pack. Text START to resume.")
            return

        if not text:
            # Image-only message (audio above either became `text` or already
            # returned). The "new" greeting doesn't read message content, so
            # treat it like any first contact; every other pre-active stage
            # needs an actual text answer.
            if state.stage == "new":
                reply = await _handle_onboarding(state, "")
            elif state.stage == "active":
                reply = "Got your photo — outfit help is coming soon."
            else:
                reply = STAGE_REPROMPTS.get(state.stage, "Let's finish setting you up first.")
        else:
            reply = await _handle_onboarding(state, text)

        if reply:
            await linq_service.send_message(chat_id, reply)
    except Exception:
        logger.exception("Failed processing iMessage onboarding for %s", phone)


@router.post("/webhook")
async def imessage_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    webhook_id: str = Header(None),
    webhook_timestamp: str = Header(None),
    webhook_signature: str = Header(None),
):
    raw_body = await request.body()

    if not (webhook_id and webhook_timestamp and webhook_signature):
        raise HTTPException(status_code=401, detail="Missing webhook signature headers")

    if not linq_service.verify_webhook_signature(webhook_id, webhook_timestamp, raw_body, webhook_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = await request.json()

    if event.get("event_type") != "message.received":
        return {"received": True}

    event_id = event.get("event_id")
    if event_id:
        already_seen = await WebhookEvent.find_one(WebhookEvent.event_id == event_id)
        if already_seen:
            return {"received": True}
        try:
            await WebhookEvent(event_id=event_id).insert()
        except DuplicateKeyError:
            # Lost a race against a concurrent redelivery of the same event —
            # the other request owns processing it, so treat this as a dupe too.
            return {"received": True}

    # Acknowledge Linq immediately; real work (including future Claude Vision
    # calls on item/outfit photos) happens after the response is sent so a
    # slow step never reads as a timeout and triggers a Linq retry.
    background_tasks.add_task(_process_event, event)
    return {"received": True}
