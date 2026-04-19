from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.user import User, Avatar, AvatarAppearance, AvatarFitProfile, AvatarPreferences
from app.api.deps import get_current_user
from app.services.cloudinary_service import upload_avatar_ref, upload_avatar_permanent
from app.services.claude_service import analyse_avatar_photos, generate_avatar_prompt, run_fal_generation

router = APIRouter()


@router.post("/me/avatar/analyse")
async def analyse_avatar(
    front: UploadFile = File(...),
    angle: Optional[UploadFile] = File(None),
    side: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    photo_urls = []
    for slot, upload in [("front", front), ("angle", angle), ("side", side)]:
        if upload and upload.filename:
            data = await upload.read()
            try:
                result = await upload_avatar_ref(data, str(current_user.id), slot)
                photo_urls.append(result["url"])
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Photo upload failed: {str(e)}")

    if not photo_urls:
        raise HTTPException(status_code=400, detail="At least one photo is required.")

    try:
        analysis = await analyse_avatar_photos(photo_urls)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Photo analysis failed: {str(e)}")

    return {
        "success": True,
        "data": {
            "analysis": analysis,
            "photo_urls": photo_urls,
        },
        "message": "",
    }


@router.post("/me/avatar/upload-refs")
async def upload_extra_refs(
    extra_0: Optional[UploadFile] = File(None),
    extra_1: Optional[UploadFile] = File(None),
    extra_2: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    """Upload additional reference photos to Cloudinary (no analysis)."""
    urls = []
    for slot, upload in [("extra_0", extra_0), ("extra_1", extra_1), ("extra_2", extra_2)]:
        if upload and upload.filename:
            data = await upload.read()
            result = await upload_avatar_ref(data, str(current_user.id), slot)
            urls.append(result["url"])
    return {"success": True, "data": {"photo_urls": urls}, "message": ""}


class GenerateBody(BaseModel):
    photo_urls: List[str]
    appearance: dict
    fit_profile: dict
    preferences: dict
    feedback: Optional[str] = None
    previous_prompt: Optional[str] = None


@router.post("/me/avatar/generate")
async def generate_avatar(
    body: GenerateBody,
    current_user: User = Depends(get_current_user),
):
    try:
        prompt = await generate_avatar_prompt(body.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt generation failed: {str(e)}")

    try:
        variation_urls = await run_fal_generation(prompt, body.photo_urls)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

    return {
        "success": True,
        "data": {
            "variation_urls": variation_urls,
            "generation_prompt": prompt,
        },
        "message": "",
    }


class SaveBody(BaseModel):
    chosen_url: str
    variation_urls: List[str]
    generation_prompt: str
    fit_profile: dict
    appearance: dict
    preferences: dict


@router.patch("/me/avatar/save")
async def save_avatar(
    body: SaveBody,
    current_user: User = Depends(get_current_user),
):
    try:
        permanent = await upload_avatar_permanent(body.chosen_url, str(current_user.id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save avatar image: {str(e)}")

    a = body.appearance
    f = body.fit_profile
    p = body.preferences

    current_user.avatar = Avatar(
        base_url=permanent["url"],
        variation_urls=body.variation_urls,
        generated_at=datetime.utcnow(),
        generation_prompt=body.generation_prompt,
        fit_profile=AvatarFitProfile(
            shirt_size=f.get("shirt_size", ""),
            waist_size=f.get("waist_size", ""),
            dress_size=f.get("dress_size", ""),
            height=f.get("height", ""),
            inseam=f.get("inseam", ""),
        ),
        appearance=AvatarAppearance(
            hair_color=a.get("hair_color", ""),
            hair_texture=a.get("hair_texture", ""),
            hair_length=a.get("hair_length", ""),
            skin_tone=a.get("skin_tone", ""),
            face_shape=a.get("face_shape", ""),
            body_silhouette=a.get("body_silhouette", ""),
            notable_features=a.get("notable_features", ""),
            hijab=a.get("hijab", False),
        ),
        preferences=AvatarPreferences(
            makeup=p.get("makeup", ""),
            vibe=p.get("vibe", ""),
            features_to_preserve=p.get("features_to_preserve", []),
        ),
    )
    await current_user.save()

    return {
        "success": True,
        "data": {"base_url": permanent["url"]},
        "message": "Avatar saved.",
    }


class SelectAvatarBody(BaseModel):
    base_url: str
    vibe: Optional[str] = None  # "Polished" | "Realistic" | "Idealized"


@router.patch("/me/avatar/select")
async def select_avatar_variant(
    body: SelectAvatarBody,
    current_user: User = Depends(get_current_user),
):
    """Switch the active avatar to one of the existing variation_urls."""
    if not current_user.avatar:
        raise HTTPException(status_code=400, detail="No avatar exists")

    all_urls = [current_user.avatar.base_url] + (current_user.avatar.variation_urls or [])
    if body.base_url not in all_urls:
        raise HTTPException(status_code=400, detail="URL not in existing variants")

    current_user.avatar.base_url = body.base_url
    if body.vibe:
        current_user.avatar.preferences.vibe = body.vibe
    await current_user.save()

    return {
        "success": True,
        "user": current_user.model_dump(),
        "message": "Avatar updated.",
    }
