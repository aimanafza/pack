import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.models.waitlist import WaitlistEntry
from app.services.email import send_waitlist_notification, send_invite_email

router = APIRouter()


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


@router.get("/approve/{email}", response_class=HTMLResponse)
async def approve_waitlist(email: str):
    entry = await WaitlistEntry.find_one(WaitlistEntry.email == email)
    if not entry:
        raise HTTPException(status_code=404, detail="Email not found in waitlist.")

    token = str(uuid.uuid4())
    entry.status = "approved"
    entry.invite_token = token
    await entry.save()

    send_invite_email(email, token)

    return f"""
    <html>
      <body style="font-family: Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F7F5F2; color: #1A1A18;">
        <div style="text-align: center; padding: 40px;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #9c9890; margin-bottom: 24px;">PACK</p>
          <h1 style="font-size: 32px; font-weight: 300; font-style: italic; margin: 0 0 12px;">Approved.</h1>
          <p style="font-size: 15px; font-weight: 300; color: #5a5852;">Invite sent to {email}</p>
        </div>
      </body>
    </html>
    """


@router.get("/reject/{email}", response_class=HTMLResponse)
async def reject_waitlist(email: str):
    entry = await WaitlistEntry.find_one(WaitlistEntry.email == email)
    if not entry:
        raise HTTPException(status_code=404, detail="Email not found in waitlist.")

    entry.status = "rejected"
    await entry.save()

    return f"""
    <html>
      <body style="font-family: Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F7F5F2; color: #1A1A18;">
        <div style="text-align: center; padding: 40px;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #9c9890; margin-bottom: 24px;">PACK</p>
          <h1 style="font-size: 32px; font-weight: 300; font-style: italic; margin: 0 0 12px;">Rejected.</h1>
          <p style="font-size: 15px; font-weight: 300; color: #5a5852;">{email}</p>
        </div>
      </body>
    </html>
    """
