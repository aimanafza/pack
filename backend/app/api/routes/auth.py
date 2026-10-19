from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from datetime import datetime, timedelta
import logging
import random
import string
from app.models.user import User, UserPreferences
from app.models.waitlist import WaitlistEntry
from app.core.security import hash_password, verify_password
from app.services.auth_service import create_access_token
from app.services.cloudinary_service import upload_profile_picture
from app.services.email import send_reset_code_email, send_login_code_email
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

LOGIN_CODE_EXPIRE_MINUTES = 15
LOGIN_CODE_MAX_ATTEMPTS = 5


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str
    invite_token: str


class LoginBody(BaseModel):
    email: str
    password: str


class ForgotPasswordBody(BaseModel):
    email: str


class ResetPasswordBody(BaseModel):
    email: str
    code: str
    new_password: str


class RequestLoginCodeBody(BaseModel):
    email: str


class VerifyLoginCodeBody(BaseModel):
    email: str
    code: str


@router.post("/register")
async def register(body: RegisterBody):
    waitlist_entry = await WaitlistEntry.find_one(WaitlistEntry.invite_token == body.invite_token)
    if not waitlist_entry or waitlist_entry.status != "approved" or waitlist_entry.token_used:
        raise HTTPException(status_code=403, detail="Invalid or already used invite token.")
    if waitlist_entry.invite_token_expires and datetime.utcnow() > waitlist_entry.invite_token_expires:
        raise HTTPException(status_code=403, detail="This invite has expired. Ask for a new invite.")
    if waitlist_entry.email != body.email:
        raise HTTPException(status_code=403, detail="This invite is for a different email address.")

    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    await user.insert()

    waitlist_entry.token_used = True
    await waitlist_entry.save()

    token = create_access_token(str(user.id))
    return {
        "success": True,
        "data": {"token": token, "user": {"id": str(user.id), "name": user.name, "email": user.email}},
        "message": "",
    }


@router.post("/login")
async def login(body: LoginBody):
    user = await User.find_one(User.email == body.email)
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user.id))
    return {
        "success": True,
        "data": {"token": token, "user": {"id": str(user.id), "name": user.name, "email": user.email}},
        "message": "",
    }


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody):
    user = await User.find_one(User.email == body.email)
    if not user:
        return {"success": True, "data": None, "message": "If that email is registered, a code has been sent."}

    code = "".join(random.choices(string.digits, k=6))
    user.reset_code = code
    user.reset_code_expires = datetime.utcnow() + timedelta(minutes=15)
    await user.save()

    send_reset_code_email(user.email, code)
    return {
        "success": True,
        "data": None,
        "message": "If that email is registered, a reset code has been sent.",
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody):
    user = await User.find_one(User.email == body.email)
    if not user or not user.reset_code:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")
    if user.reset_code != body.code:
        raise HTTPException(status_code=400, detail="Incorrect reset code.")
    if datetime.utcnow() > user.reset_code_expires:
        raise HTTPException(status_code=400, detail="Reset code expired. Request a new one.")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.password_hash = hash_password(body.new_password)
    user.reset_code = None
    user.reset_code_expires = None
    await user.save()

    return {"success": True, "data": None, "message": "Password updated. You can now sign in."}


@router.post("/request-login-code")
async def request_login_code(body: RequestLoginCodeBody):
    user = await User.find_one(User.email == body.email)
    generic_message = {
        "success": True,
        "data": None,
        "message": "If that email has a Pack account, a code has been sent.",
    }
    if not user:
        return generic_message

    code = "".join(random.choices(string.digits, k=6))
    user.login_code = code
    user.login_code_expires = datetime.utcnow() + timedelta(minutes=LOGIN_CODE_EXPIRE_MINUTES)
    user.login_code_attempts = 0
    await user.save()

    try:
        send_login_code_email(user.email, code)
    except Exception:
        logger.exception("Failed to send login code email to %s", user.email)
    return generic_message


@router.post("/verify-login-code")
async def verify_login_code(body: VerifyLoginCodeBody):
    invalid = HTTPException(status_code=400, detail="Invalid or expired code.")
    user = await User.find_one(User.email == body.email)
    if not user or not user.login_code or not user.login_code_expires:
        raise invalid
    if datetime.utcnow() > user.login_code_expires:
        user.login_code = None
        user.login_code_expires = None
        await user.save()
        raise HTTPException(status_code=400, detail="Code expired. Request a new one.")
    if user.login_code_attempts >= LOGIN_CODE_MAX_ATTEMPTS:
        user.login_code = None
        user.login_code_expires = None
        await user.save()
        raise HTTPException(status_code=400, detail="Too many attempts. Request a new code.")
    if body.code != user.login_code:
        user.login_code_attempts += 1
        await user.save()
        remaining = LOGIN_CODE_MAX_ATTEMPTS - user.login_code_attempts
        raise HTTPException(status_code=400, detail=f"Incorrect code. {remaining} attempt(s) left.")

    user.login_code = None
    user.login_code_expires = None
    user.login_code_attempts = 0
    await user.save()

    token = create_access_token(str(user.id))
    return {
        "success": True,
        "data": {"token": token, "user": {"id": str(user.id), "name": user.name, "email": user.email}},
        "message": "",
    }


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "profile_picture": current_user.profile_picture,
            "preferences": current_user.preferences.model_dump(),
            "style_dna": current_user.style_dna.model_dump() if current_user.style_dna else None,
            "avatar": current_user.avatar.model_dump() if current_user.avatar else None,
            "dashboard_carpet_url": current_user.dashboard_carpet_url,
        },
        "message": "",
    }


@router.patch("/me/preferences")
async def update_preferences(
    body: UserPreferences,
    current_user: User = Depends(get_current_user),
):
    current_user.preferences = body
    await current_user.save()
    return {
        "success": True,
        "data": {"preferences": current_user.preferences.model_dump()},
        "message": "Preferences saved",
    }


@router.patch("/me/profile-picture")
async def update_profile_picture(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    image_data = await image.read()
    result = await upload_profile_picture(image_data, str(current_user.id))
    current_user.profile_picture = result["url"]
    await current_user.save()
    return {
        "success": True,
        "data": {"profile_picture_url": result["url"]},
        "message": "Profile picture updated",
    }
