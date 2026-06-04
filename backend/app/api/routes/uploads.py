from fastapi import APIRouter, Depends, UploadFile, File
from app.models.user import User
from app.api.deps import get_current_user
import cloudinary.uploader
from app.core.config import settings
import cloudinary

router = APIRouter()

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


@router.post("/image")
async def upload_image(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an image to Cloudinary (inspiration images, etc.) and return the URL."""
    image_data = await image.read()
    result = cloudinary.uploader.upload(
        image_data,
        folder=f"pack/inspiration/{current_user.id}",
        transformation=[
            {"quality": "auto"},
            {"fetch_format": "auto"},
        ],
    )
    return {
        "success": True,
        "data": {
            "url": result["secure_url"],
            "public_id": result["public_id"],
        },
    }
