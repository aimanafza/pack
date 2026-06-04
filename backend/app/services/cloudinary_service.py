import logging
import cloudinary
import cloudinary.uploader
from app.core.config import settings

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


async def upload_wardrobe_item(file, user_id: str) -> dict:
    """Upload a wardrobe item to Cloudinary, attempting background removal via e_bgremoval.

    `file` can be raw bytes or a URL string. When a URL is given the image is
    downloaded first so we always upload bytes — avoids Cloudinary refusing to
    fetch its own hosted URLs during re-uploads from the AI-autofill flow.

    Background removal is attempted but non-fatal: if the add-on is unavailable
    or quota is exhausted, the original image is saved and the upload still succeeds.
    """
    import httpx

    if isinstance(file, str):
        async with httpx.AsyncClient(timeout=30) as http:
            r = await http.get(file)
            r.raise_for_status()
            file = r.content

    # Attempt upload with background removal
    try:
        result = cloudinary.uploader.upload(
            file,
            folder=f"pack/wardrobe/{user_id}",
            resource_type="image",
            eager=[{"effect": "e_bgremoval", "quality": "auto", "format": "png"}],
            eager_async=False,
        )
        if result.get("eager") and len(result["eager"]) > 0:
            url = result["eager"][0]["secure_url"]
            logger.info(f"e_bgremoval succeeded: {url}")
        else:
            url = result["secure_url"]
            logger.warning("e_bgremoval eager result missing — using original URL")
    except Exception as e:
        logger.warning(f"Background removal failed ({e}), falling back to plain upload")
        result = cloudinary.uploader.upload(
            file,
            folder=f"pack/wardrobe/{user_id}",
            resource_type="image",
        )
        url = result["secure_url"]

    return {
        "url": url,
        "public_id": result["public_id"],
    }


async def delete_wardrobe_item(public_id: str) -> None:
    cloudinary.uploader.destroy(public_id)


async def upload_inspiration_image(file, user_id: str, trip_id: str) -> dict:
    result = cloudinary.uploader.upload(
        file,
        folder=f"pack/inspiration/{user_id}/{trip_id}",
        transformation=[
            {"quality": "auto"},
            {"fetch_format": "auto"},
        ],
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }


async def delete_inspiration_image(public_id: str) -> None:
    cloudinary.uploader.destroy(public_id)


async def upload_avatar_permanent(url: str, user_id: str) -> dict:
    """Download a fal.ai URL and upload to Cloudinary for permanent storage."""
    import httpx
    async with httpx.AsyncClient() as http:
        r = await http.get(url)
        image_data = r.content
    result = cloudinary.uploader.upload(
        image_data,
        folder="pack/avatars",
        public_id=f"avatar_{user_id}",
        overwrite=True,
        transformation=[
            {"quality": "auto"},
            {"fetch_format": "auto"},
        ],
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }


async def upload_avatar_ref(file, user_id: str, slot: str) -> dict:
    result = cloudinary.uploader.upload(
        file,
        folder=f"pack/avatar_refs/{user_id}",
        public_id=f"{slot}_{user_id}",
        overwrite=True,
        transformation=[
            {"quality": "auto"},
            {"fetch_format": "auto"},
        ],
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }


async def upload_carpet_image(url: str, user_id: str) -> dict:
    """Download a fal.ai carpet URL and upload to Cloudinary for permanent storage."""
    import httpx
    async with httpx.AsyncClient() as http:
        r = await http.get(url)
        image_data = r.content
    result = cloudinary.uploader.upload(
        image_data,
        folder="pack/carpets",
        public_id=f"carpet_{user_id}",
        overwrite=True,
        transformation=[
            {"quality": "auto"},
            {"fetch_format": "auto"},
        ],
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }


async def upload_profile_picture(file, user_id: str) -> dict:
    result = cloudinary.uploader.upload(
        file,
        folder="pack/profile_pictures",
        public_id=f"user_{user_id}",
        overwrite=True,
        transformation=[
            {"width": 200, "height": 200, "crop": "fill", "gravity": "face"},
            {"quality": "auto"},
            {"fetch_format": "auto"},
        ],
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }
