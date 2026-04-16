from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from datetime import datetime, timedelta
import random
import string
from app.models.user import User, UserPreferences
from app.core.security import hash_password, verify_password
from app.services.auth_service import create_access_token
from app.services.cloudinary_service import upload_profile_picture
from app.api.deps import get_current_user

router = APIRouter()


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str


class LoginBody(BaseModel):
    email: str
    password: str


class ForgotPasswordBody(BaseModel):
    email: str


class ResetPasswordBody(BaseModel):
    email: str
    code: str
    new_password: str


@router.post("/register")
async def register(body: RegisterBody):
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    await user.insert()
    token = create_access_token(str(user.id))
    return {
        "success": True,
        "data": {"token": token, "user": {"id": str(user.id), "name": user.name, "email": user.email}},
        "message": "",
    }


@router.post("/login")
async def login(body: LoginBody):
    user = await User.find_one(User.email == body.email)
    if not user or not verify_password(body.password, user.password_hash):
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

    # In production this would be emailed — for capstone dev, returned directly
    return {
        "success": True,
        "data": {"code": code, "expires_in": "15 minutes"},
        "message": "Reset code generated.",
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


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "profile_picture": current_user.profile_picture,
            "style_preferences": current_user.style_preferences.model_dump(),
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
