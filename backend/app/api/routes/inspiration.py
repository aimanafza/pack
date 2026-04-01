from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from typing import List
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.user import User
from app.models.trip import Trip, InspirationImage, VibeAnalysis
from app.api.deps import get_current_user
from app.services.cloudinary_service import upload_inspiration_image
from app.services.claude_service import analyze_vibe

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/{trip_id}/inspiration/upload")
async def upload_inspiration(
    trip_id: str,
    images: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    if len(images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 inspiration images allowed")

    uploaded = []
    for img in images:
        contents = await img.read()
        result = await upload_inspiration_image(contents, str(current_user.id), trip_id)
        uploaded.append(InspirationImage(url=result["url"], cloudinary_public_id=result["public_id"]))

    trip.inspiration_images.extend(uploaded)
    await trip.save()

    return {"success": True, "data": trip.model_dump(), "message": f"{len(uploaded)} image(s) uploaded"}


@router.post("/{trip_id}/inspiration/analyze")
@limiter.limit("5/minute")
async def analyze_inspiration(
    request: Request,
    trip_id: str,
    current_user: User = Depends(get_current_user),
):
    trip = await Trip.get(trip_id)
    if not trip or trip.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    if not trip.inspiration_images:
        raise HTTPException(status_code=400, detail="No inspiration images uploaded yet")

    image_urls = [img.url for img in trip.inspiration_images]
    try:
        result = await analyze_vibe(image_urls)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    trip.vibe_analysis = VibeAnalysis(**result)
    await trip.save()

    return {"success": True, "data": trip.model_dump(), "message": "Vibe analyzed"}
