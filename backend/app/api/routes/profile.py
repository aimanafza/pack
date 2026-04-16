from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import User, StyleDNA
from app.models.item import WardrobeItem
from app.models.trip import Trip
from app.api.deps import get_current_user
from app.services.claude_service import analyze_style_dna, build_carpet_image, CATEGORY_LABELS

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/analyze-style")



@limiter.limit("20/hour")

async def analyze_style(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    wardrobe = await WardrobeItem.find(
        WardrobeItem.user_id == current_user.id
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


@router.post("/generate-carpet")
async def generate_carpet(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Trigger carpet image generation for the current user.

    Returns immediately if already generated. Checks that the user has 5+
    approved outfits before kicking off the background task.
    """
    if current_user.dashboard_carpet_url:
        return {
            "success": True,
            "data": {"dashboard_carpet_url": current_user.dashboard_carpet_url},
            "message": "Already generated",
        }

    all_trips = await Trip.find(Trip.user_id == current_user.id).to_list()
    total_approved = sum(len(t.approved_outfits) for t in all_trips)

    if total_approved < 5:
        raise HTTPException(
            status_code=422,
            detail=f"Need at least 5 approved outfits ({total_approved} so far).",
        )

    background_tasks.add_task(build_carpet_image, current_user)
    return {
        "success": True,
        "data": {"dashboard_carpet_url": None},
        "message": "Carpet generation started",
    }
