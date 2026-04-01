from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import User, StyleDNA
from app.models.item import WardrobeItem
from app.api.deps import get_current_user
from app.services.claude_service import analyze_style_dna, CATEGORY_LABELS

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

    # Compute category breakdown directly from wardrobe
    breakdown: dict[str, int] = {}
    for item in wardrobe:
        label = CATEGORY_LABELS.get(item.category, item.category.capitalize())
        breakdown[label] = breakdown.get(label, 0) + 1

    style_dna = StyleDNA(
        headline=result.get("headline", ""),
        color_palette=result.get("color_palette", []),
        style_keywords=result.get("style_keywords", []),
        category_breakdown=breakdown,
        signature_piece_ids=result.get("signature_piece_ids", []),
        style_gaps=result.get("style_gaps", []),
        stylist_paragraph=result.get("stylist_paragraph", ""),
        generated_at=datetime.utcnow(),
    )

    current_user.style_dna = style_dna
    await current_user.save()

    return {"success": True, "data": style_dna.model_dump(), "message": "Style DNA analyzed"}
