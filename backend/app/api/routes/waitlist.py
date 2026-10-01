import html
import uuid
from datetime import datetime, timedelta
from urllib.parse import quote
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.core.config import settings
from app.models.waitlist import WaitlistEntry
from app.services.email import send_waitlist_notification, send_invite_email

router = APIRouter()

INVITE_TOKEN_EXPIRE_DAYS = 14

PAGE_STYLE = "font-family: Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F7F5F2; color: #1A1A18;"
LABEL_STYLE = "font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #9c9890; margin-bottom: 24px;"
TITLE_STYLE = "font-size: 32px; font-weight: 300; font-style: italic; margin: 0 0 12px;"
SUB_STYLE = "font-size: 15px; font-weight: 300; color: #5a5852;"
BUTTON_STYLE = "display: inline-block; margin-top: 28px; background: #1A1A18; color: #ffffff; font-family: sans-serif; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; padding: 12px 28px; border: none; cursor: pointer;"


def _page(label: str, title: str, sub: str, button_html: str = "") -> str:
    return f"""
    <html>
      <body style="{PAGE_STYLE}">
        <div style="text-align: center; padding: 40px;">
          <p style="{LABEL_STYLE}">{label}</p>
          <h1 style="{TITLE_STYLE}">{title}</h1>
          <p style="{SUB_STYLE}">{sub}</p>
          {button_html}
        </div>
      </body>
    </html>
    """


class WaitlistBody(BaseModel):
    email: str


@router.post("")
async def join_waitlist(body: WaitlistBody):
    existing = await WaitlistEntry.find_one(WaitlistEntry.email == body.email)
    if existing:
        raise HTTPException(status_code=400, detail="This email is already on the waitlist.")

    entry = WaitlistEntry(email=body.email)
    await entry.insert()

    send_waitlist_notification(body.email)

    return {
        "success": True,
        "data": None,
        "message": "You're on the list. We'll be in touch.",
    }


def _check_secret(secret: str) -> None:
    if not settings.WAITLIST_ADMIN_SECRET or secret != settings.WAITLIST_ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized.")


async def _get_entry(email: str) -> WaitlistEntry:
    entry = await WaitlistEntry.find_one(WaitlistEntry.email == email)
    if not entry:
        raise HTTPException(status_code=404, detail="Email not found in waitlist.")
    return entry


# GET renders a confirmation page only, with no state change, so an email
# scanner or link-preview auto-fetching this URL can't approve/reject anyone.
# The actual mutation happens on POST, triggered by the button below.
@router.get("/approve/{email}", response_class=HTMLResponse)
async def confirm_approve_waitlist(email: str, secret: str = Query(...)):
    _check_secret(secret)
    await _get_entry(email)
    button = f"""
    <form method="POST" action="/waitlist/approve/{quote(email, safe='')}?secret={secret}">
      <button type="submit" style="{BUTTON_STYLE}">Confirm Approve</button>
    </form>
    """
    return _page("Pack waitlist request", "Approve this applicant?", html.escape(email), button)


@router.post("/approve/{email}", response_class=HTMLResponse)
async def approve_waitlist(email: str, secret: str = Query(...)):
    _check_secret(secret)
    entry = await _get_entry(email)

    token = str(uuid.uuid4())
    entry.status = "approved"
    entry.invite_token = token
    entry.invite_token_expires = datetime.utcnow() + timedelta(days=INVITE_TOKEN_EXPIRE_DAYS)
    entry.token_used = False
    await entry.save()

    send_invite_email(email, token, INVITE_TOKEN_EXPIRE_DAYS)

    return _page("PACK", "Approved.", f"Invite sent to {html.escape(email)}")


@router.get("/reject/{email}", response_class=HTMLResponse)
async def confirm_reject_waitlist(email: str, secret: str = Query(...)):
    _check_secret(secret)
    await _get_entry(email)
    button = f"""
    <form method="POST" action="/waitlist/reject/{quote(email, safe='')}?secret={secret}">
      <button type="submit" style="{BUTTON_STYLE}">Confirm Reject</button>
    </form>
    """
    return _page("Pack waitlist request", "Reject this applicant?", html.escape(email), button)


@router.post("/reject/{email}", response_class=HTMLResponse)
async def reject_waitlist(email: str, secret: str = Query(...)):
    _check_secret(secret)
    entry = await _get_entry(email)

    entry.status = "rejected"
    await entry.save()

    return _page("PACK", "Rejected.", html.escape(email))
