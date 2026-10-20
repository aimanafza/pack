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
    """Upload a wardrobe item to Cloudinary with its background removed.

    `file` can be raw bytes or a URL string. When a URL is given the image is
    downloaded first so we always upload bytes; Cloudinary won't re-fetch its own
    hosted URLs during re-uploads from the AI-autofill flow.

    Removal runs as the image is stored (Cloudinary's `background_removal` effect),
    saved as PNG so the transparency survives. If removal fails (add-on disabled or
    out of quota) the original is saved so the upload still succeeds, and the
    failure is logged as an error so it can't go unnoticed again.
    """
    import httpx

    if isinstance(file, str):
        try:
            # Shops often turn away requests that don't look like a browser
            headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
            async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=headers) as http:
                r = await http.get(file)
                r.raise_for_status()
                file = r.content
        except Exception:
            # Some shops refuse our download; Cloudinary can usually fetch those itself.
            # Its own URLs are the exception, so those still have to fail here.
            if "res.cloudinary.com" in file:
                raise

    folder = f"pack/wardrobe/{user_id}"
    try:
        result = cloudinary.uploader.upload(
            file,
            folder=folder,
            resource_type="image",
            transformation=[{"effect": "background_removal"}],
            format="png",
        )
        return {"url": result["secure_url"], "public_id": result["public_id"], "background_removed": True}
    except Exception as e:
        logger.error(f"Background removal failed for user {user_id}, saving the original photo: {e}")
        result = cloudinary.uploader.upload(file, folder=folder, resource_type="image")
        return {"url": result["secure_url"], "public_id": result["public_id"], "background_removed": False}


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
