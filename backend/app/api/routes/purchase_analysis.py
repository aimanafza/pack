from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from beanie import PydanticObjectId

from app.models.purchase_analysis import PurchaseAnalysis, ScoreBreakdown, OutfitCombination
from app.models.user import User
from app.models.item import WardrobeItem
from app.services.claude_service import analyse_purchase
from app.api.deps import get_current_user

router = APIRouter()


class AnalyseRequest(BaseModel):
    product_url: str
    product_name: str = ""
    product_image_url: str = ""
    price: Optional[float] = None
    currency: str = "USD"
    brand: str = ""


@router.post("/analyse")
async def analyse_purchase_endpoint(
    body: AnalyseRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    wardrobe = await WardrobeItem.find(
        WardrobeItem.user_id == current_user.id
    ).to_list()

    wardrobe_dicts = [
        {
            "id": str(w.id),
            "name": w.name,
            "category": w.category,
            "color": w.color,
            "fabric": w.fabric,
            "occasions": w.occasions,
            "formality": w.formality,
            "season": w.season,
            "image_url": w.image_url,
        }
        for w in wardrobe
    ]

    style_context = {
        "style_dna": current_user.style_dna.model_dump() if current_user.style_dna else {},
        "preferences": current_user.preferences.model_dump() if current_user.preferences else {},
        "shopping_profile": current_user.shopping_profile.model_dump() if current_user.shopping_profile else {},
    }

    result = await analyse_purchase(
        product={
            "url": body.product_url,
            "name": body.product_name,
            "image_url": body.product_image_url,
            "price": body.price,
            "currency": body.currency,
            "brand": body.brand,
        },
        wardrobe=wardrobe_dicts,
        style_context=style_context,
    )

    # Parse outfit combinations from result
    outfit_combinations = [
        OutfitCombination(
            name=o.get("name", ""),
            items=o.get("items", []),
            occasion=o.get("occasion", ""),
            styling_note=o.get("styling_note", ""),
        )
        for o in result.get("outfit_combinations", [])[:3]
    ]

    analysis = PurchaseAnalysis(
        user_id=current_user.id,
        product_url=body.product_url,
        product_name=body.product_name,
        product_image_url=body.product_image_url,
        price=body.price,
        currency=body.currency,
        brand=body.brand,
        scores=ScoreBreakdown(**{
            k: v for k, v in result.get("scores", {}).items()
            if k in ScoreBreakdown.model_fields
        }),
        verdict=result.get("verdict", ""),
        archetype=result.get("archetype", ""),
        archetype_note=result.get("archetype_note", ""),
        style_expansion_note=result.get("style_expansion_note", ""),
        brand_quality_note=result.get("brand_quality_note", ""),
        outfit_count=result.get("outfit_count", 0),
        outfit_combinations=outfit_combinations,
        outfit_collages=result.get("outfit_collages", []),
        expansion_question_asked=True,
    )
    await analysis.insert()

    background_tasks.add_task(_update_shopping_profile, str(current_user.id))

    return {"success": True, "data": analysis.model_dump(mode="json")}


@router.post("/looks")
async def generate_looks_endpoint(
    body: AnalyseRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate outfit looks for the extension's Looks view.
    Returns outfit combinations with collage image arrays."""
    wardrobe = await WardrobeItem.find(
        WardrobeItem.user_id == current_user.id
    ).to_list()

    wardrobe_dicts = [
        {
            "id": str(w.id),
            "name": w.name,
            "category": w.category,
            "color": w.color,
            "fabric": w.fabric,
            "occasions": w.occasions,
            "formality": w.formality,
            "season": w.season,
            "image_url": w.image_url,
        }
        for w in wardrobe
    ]

    style_context = {
        "style_dna": current_user.style_dna.model_dump() if current_user.style_dna else {},
        "preferences": current_user.preferences.model_dump() if current_user.preferences else {},
        "shopping_profile": current_user.shopping_profile.model_dump() if current_user.shopping_profile else {},
    }

    result = await analyse_purchase(
        product={
            "url": body.product_url,
            "name": body.product_name,
            "image_url": body.product_image_url,
            "price": body.price,
            "currency": body.currency,
            "brand": body.brand,
        },
        wardrobe=wardrobe_dicts,
        style_context=style_context,
    )

    return {"success": True, "data": result}


@router.patch("/{analysis_id}/expansion")
async def update_expansion_answer(
    analysis_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
):
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not analysis or str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    analysis.expansion_answer = body.get("answer", "")
    await analysis.save()
    return {"success": True}


@router.patch("/{analysis_id}/bought")
async def update_bought_status(
    analysis_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not analysis or str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis.bought = body.get("bought")
    analysis.passed_note = body.get("passed_note", "")
    await analysis.save()

    if analysis.bought is True:
        background_tasks.add_task(
            _auto_add_to_wardrobe,
            str(analysis.id),
            str(current_user.id),
            analysis.product_url,
            analysis.product_image_url,
            analysis.product_name,
        )

    background_tasks.add_task(_update_shopping_profile, str(current_user.id))
    return {"success": True}


@router.get("/me")
async def get_my_analyses(current_user: User = Depends(get_current_user)):
    analyses = await PurchaseAnalysis.find(
        PurchaseAnalysis.user_id == current_user.id
    ).sort(-PurchaseAnalysis.created_at).to_list()
    return {"success": True, "data": [a.model_dump(mode="json") for a in analyses]}


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
):
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not analysis or str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"success": True, "data": analysis.model_dump(mode="json")}


# ── Background tasks ──────────────────────────────────────────────────────────

async def _update_shopping_profile(user_id: str):
    """Recalculate shopping profile stats from all analyses."""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        return
    analyses = await PurchaseAnalysis.find(
        PurchaseAnalysis.user_id == PydanticObjectId(user_id)
    ).to_list()
    total = len(analyses)
    bought = sum(1 for a in analyses if a.bought is True)
    impulse = sum(1 for a in analyses if a.expansion_answer == "impulse")
    user.shopping_profile.total_analyses = total
    user.shopping_profile.total_bought = bought
    user.shopping_profile.impulse_ratio = impulse / total if total > 0 else 0.0
    user.shopping_profile.last_updated = datetime.utcnow()
    await user.save()


async def _auto_add_to_wardrobe(
    analysis_id: str,
    user_id: str,
    product_url: str,
    product_image_url: str,
    product_name: str,
):
    """Upload product image to Cloudinary with background removal,
    run Claude Vision autofill, and save as a wardrobe item."""
    from app.models.item import WardrobeItem
    from app.services.claude_service import analyse_wardrobe_item_image
    import cloudinary.uploader

    user = await User.get(PydanticObjectId(user_id))
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not user or not analysis or not product_image_url:
        return

    try:
        # Upload to Cloudinary with background removal
        try:
            upload_result = cloudinary.uploader.upload(
                product_image_url,
                folder="pack/wardrobe",
                eager=[{"effect": "e_bgremoval"}],
                eager_async=False,
            )
            cloudinary_url = (
                upload_result.get("eager", [{}])[0].get("secure_url")
                or upload_result.get("secure_url")
            )
        except Exception:
            # Fallback without background removal
            upload_result = cloudinary.uploader.upload(
                product_image_url,
                folder="pack/wardrobe",
                resource_type="image",
            )
            cloudinary_url = upload_result.get("secure_url", "")

        if not cloudinary_url:
            return

        # Run Claude Vision autofill
        metadata = await analyse_wardrobe_item_image(cloudinary_url)

        item = WardrobeItem(
            user_id=PydanticObjectId(user_id),
            name=metadata.get("name") or product_name,
            category=metadata.get("category", "top"),
            subcategory=metadata.get("subcategory", ""),
            color=metadata.get("color", []),
            fabric=metadata.get("fabric", "other"),
            formality=metadata.get("formality", []),
            occasions=metadata.get("occasions", []),
            season=metadata.get("season", []),
            weight_grams=metadata.get("weight_grams", 300),
            notes=f"Added from purchase analysis. Source: {product_url}",
            image_url=cloudinary_url,
            cloudinary_public_id=upload_result.get("public_id", ""),
        )
        await item.insert()

        analysis.wardrobe_item_id = item.id
        await analysis.save()

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Auto-add to wardrobe failed: {e}")
