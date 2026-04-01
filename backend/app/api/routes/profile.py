from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import User
from app.models.item import WardrobeItem
from app.api.deps import get_current_user
from app.services.claude_service import analyze_style_dna

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/analyze-style")
@limiter.limit("3/hour")
async def analyze_style(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    wardrobe = await WardrobeItem.find(
        WardrobeItem.user_id == str(current_user.id)
    ).to_list()

    if len(wardrobe) < 3:
        raise HTTPException(
            status_code=422,
            detail="Add at least 3 wardrobe items to analyze your style.",
        )

    try:
        result = await analyze_style_dna(wardrobe)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"success": True, "data": result, "message": "Style DNA analyzed"}
