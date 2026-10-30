from types import SimpleNamespace
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import logging
from beanie import PydanticObjectId

from app.models.purchase_analysis import PurchaseAnalysis, ScoreBreakdown, OutfitCombination
from app.models.user import User
from app.models.item import WardrobeItem
from app.services.claude_service import (
    analyse_purchase,
    generate_lookbook_image,
    stage_product_image,
    _resolve_wardrobe_ref,
    explain_scores,
    _without_em_dashes,
)
from app.api.deps import get_current_user

router = APIRouter()


def _same_product(url: str) -> str:
    """A product page's address without tracking bits, so the same shoe from an ad,
    a search or a reload counts as one product."""
    from urllib.parse import urlsplit
    parts = urlsplit((url or "").strip())
    return f"{parts.netloc.lower().removeprefix('www.')}{parts.path.rstrip('/').lower()}"


async def _saved_analysis(user: User, product_url: str) -> Optional[PurchaseAnalysis]:
    """The shopper's most recent analysis of this product, if they've checked it before."""
    key = _same_product(product_url)
    if not key:
        return None
    analyses = await PurchaseAnalysis.find(PurchaseAnalysis.user_id == user.id).sort(-PurchaseAnalysis.created_at).to_list()
    return next((a for a in analyses if _same_product(a.product_url) == key), None)


async def _with_pieces(analysis: PurchaseAnalysis, user: User) -> PurchaseAnalysis:
    """Analyses saved before outfit pieces were matched properly only hold the
    product's own photo. Rebuild those outfits from the wardrobe once and keep them."""
    if not analysis.outfit_combinations or all(len(c) > 1 for c in analysis.outfit_collages):
        return analysis
    wardrobe = await WardrobeItem.find(WardrobeItem.user_id == user.id).to_list()
    wardrobe_dicts = [{"id": str(w.id), "name": w.name, "image_url": w.image_url} for w in wardrobe]
    collages = []
    for combo in analysis.outfit_combinations[:3]:
        urls = [analysis.product_image_url] if analysis.product_image_url else []
        for ref in combo.items:
            piece = _resolve_wardrobe_ref(str(ref), wardrobe_dicts)
            if piece and piece.get("image_url") and piece["image_url"] not in urls:
                urls.append(piece["image_url"])
            if len(urls) == 4:
                break
        collages.append(urls)
    if collages != analysis.outfit_collages:
        analysis.outfit_collages = collages
        await analysis.save()
    return analysis


def _public(analysis: PurchaseAnalysis) -> dict:
    """An analysis as the app and extension see it. Older analyses were saved
    with em dashes in the writing; PACK copy never shows them."""
    data = _without_em_dashes(analysis.model_dump(mode="json"))
    now = datetime.utcnow()
    data["look_pending"] = {k: v for k, v in data.get("look_pending", {}).items()
                            if now - analysis.look_pending[k] < LOOK_STALE_AFTER}
    return data


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
    # Checked this product before? Hand back that analysis instead of paying for a new one
    saved = await _saved_analysis(current_user, body.product_url)
    if saved:
        saved = await _with_pieces(saved, current_user)
        return {"success": True, "data": _public(saved)}

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
        score_notes={
            k: v for k, v in (result.get("score_notes") or {}).items()
            if k in ScoreBreakdown.model_fields and isinstance(v, str)
        },
        outfit_combinations=outfit_combinations,
        outfit_collages=result.get("outfit_collages", []),
        expansion_question_asked=True,
    )
    await analysis.insert()

    background_tasks.add_task(_update_shopping_profile, str(current_user.id))

    return {"success": True, "data": _public(analysis)}


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
    answer = body.get("answer", "")
    if answer not in ("exploring", "impulse"):
        raise HTTPException(status_code=400, detail="Answer with exploring or impulse.")
    analysis.expansion_answer = answer
    await analysis.save()

    # Refresh the impulse ratio now, so the next verdict already knows about it,
    # and tell the shopper where they stand
    await _update_shopping_profile(str(current_user.id))
    answered = await PurchaseAnalysis.find(
        PurchaseAnalysis.user_id == current_user.id,
        {"expansion_answer": {"$in": ["exploring", "impulse"]}},
    ).to_list()
    impulse = sum(1 for a in answered if a.expansion_answer == "impulse")
    return {"success": True, "data": {"impulse": impulse, "answered": len(answered)}}


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


@router.get("/for-product")
async def get_analysis_for_product(url: str, current_user: User = Depends(get_current_user)):
    """The shopper's saved analysis of a product page, or null if they haven't checked it."""
    saved = await _saved_analysis(current_user, url)
    if saved:
        saved = await _with_pieces(saved, current_user)
    return {"success": True, "data": _public(saved) if saved else None}


@router.get("/me")
async def get_my_analyses(current_user: User = Depends(get_current_user)):
    analyses = await PurchaseAnalysis.find(
        PurchaseAnalysis.user_id == current_user.id
    ).sort(-PurchaseAnalysis.created_at).to_list()
    return {"success": True, "data": [_public(a) for a in analyses]}


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
):
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not analysis or str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    analysis = await _with_pieces(analysis, current_user)
    return {"success": True, "data": _public(analysis)}


@router.post("/{analysis_id}/score-notes")
async def fill_score_notes(analysis_id: str, current_user: User = Depends(get_current_user)):
    """Explanations for each score. New analyses come with them; older ones get
    them written the first time someone opens a score, then kept."""
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not analysis or str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    if not analysis.score_notes:
        wardrobe = await WardrobeItem.find(WardrobeItem.user_id == current_user.id).to_list()
        try:
            notes = await explain_scores(analysis.model_dump(mode="json"), [w.name for w in wardrobe])
        except Exception:
            raise HTTPException(status_code=502, detail="Couldn't explain the scores right now. Try again.")
        await PurchaseAnalysis.get_motor_collection().update_one({"_id": analysis.id}, {"$set": {"score_notes": notes}})
        analysis.score_notes = notes
    return {"success": True, "data": _without_em_dashes(analysis.score_notes)}


# A look that's been "dressing" this long was cut off (a restart, a crash), so it can be tried again
LOOK_STALE_AFTER = timedelta(minutes=4)


def _look_state(analysis: PurchaseAnalysis, key: str) -> dict:
    if analysis.look_images.get(key):
        return {"status": "ready", "image_url": analysis.look_images[key]}
    started = analysis.look_pending.get(key)
    if started and datetime.utcnow() - started < LOOK_STALE_AFTER:
        return {"status": "dressing"}
    if analysis.look_errors.get(key):
        return {"status": "failed", "error": analysis.look_errors[key]}
    return {"status": "none"}


@router.post("/{analysis_id}/looks/{index}/on-me")
async def dress_avatar_in_look(
    analysis_id: str,
    index: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Start picturing the shopper's avatar in one of the analysis's outfits.
    The work runs on the server, so leaving the page doesn't stop it; the page
    checks back through the analysis (look_pending / look_images / look_errors)."""
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not analysis or str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    if not 0 <= index < len(analysis.outfit_combinations):
        raise HTTPException(status_code=404, detail="That look isn't part of this analysis.")
    if not current_user.avatar or not current_user.avatar.base_url:
        raise HTTPException(status_code=409, detail="Create your avatar in PACK first, then your looks will show on you.")

    key = str(index)
    state = _look_state(analysis, key)
    if state["status"] in ("ready", "dressing"):
        return {"success": True, "data": state}

    # Claim the look in one step, so two taps (or two tabs) never pay for it twice
    now = datetime.utcnow()
    claimed = await PurchaseAnalysis.get_motor_collection().update_one(
        {
            "_id": analysis.id,
            f"look_images.{key}": {"$exists": False},
            "$or": [
                {f"look_pending.{key}": {"$exists": False}},
                {f"look_pending.{key}": {"$lt": now - LOOK_STALE_AFTER}},
            ],
        },
        {"$set": {f"look_pending.{key}": now}, "$unset": {f"look_errors.{key}": ""}},
    )
    if claimed.modified_count:
        background_tasks.add_task(_dress_look, str(analysis.id), index, str(current_user.id))
    return {"success": True, "data": {"status": "dressing"}}


async def _dress_look(analysis_id: str, index: int, user_id: str):
    """Make the avatar image for one look and keep it on the analysis."""
    key = str(index)
    collection = PurchaseAnalysis.get_motor_collection()
    oid = PydanticObjectId(analysis_id)

    async def finish(update: dict):
        await collection.update_one({"_id": oid}, {**update, "$unset": {f"look_pending.{key}": ""}})

    try:
        analysis = await PurchaseAnalysis.get(oid)
        user = await User.get(PydanticObjectId(user_id))
        wardrobe = await WardrobeItem.find(WardrobeItem.user_id == user.id).to_list()
        wardrobe_dicts = [
            {"id": str(w.id), "name": w.name, "category": w.category, "image_url": w.image_url}
            for w in wardrobe
        ]
        combo = analysis.outfit_combinations[index]
        pieces = []
        for ref in combo.items:
            piece = _resolve_wardrobe_ref(str(ref), wardrobe_dicts)
            if piece and piece.get("image_url") and piece not in pieces:
                pieces.append(piece)

        product_image = await stage_product_image(analysis.product_image_url) if analysis.product_image_url else None
        if not product_image:
            await finish({"$set": {f"look_errors.{key}": "Couldn't load the product photo from the shop. Try again in a moment."}})
            return

        outfit = SimpleNamespace(
            name=combo.name or "Look",
            items=[SimpleNamespace(name=analysis.product_name or "the new piece", category="new piece", image_url=product_image)]
            + [SimpleNamespace(name=p["name"], category=p["category"], image_url=p["image_url"]) for p in pieces[:3]],
        )
        aesthetics = user.preferences.style_aesthetics if user.preferences else []
        image_url = await generate_lookbook_image(outfit, user.avatar, None, aesthetics, max_items=4)
    except Exception as e:
        logging.getLogger(__name__).error(f"Dressing look {key} of analysis {analysis_id} failed: {e}")
        image_url = None

    if image_url:
        await finish({"$set": {f"look_images.{key}": image_url}})
    else:
        await finish({"$set": {f"look_errors.{key}": "Couldn't dress your avatar this time. Try again."}})


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
    from app.services.cloudinary_service import upload_wardrobe_item
    from app.services import usage_service

    user = await User.get(PydanticObjectId(user_id))
    analysis = await PurchaseAnalysis.get(PydanticObjectId(analysis_id))
    if not user or not analysis or not product_image_url:
        return

    # Extension adds come out of the same monthly allowance as uploads
    if not await usage_service.reserve(user, "items_added"):
        analysis.wardrobe_add_error = usage_service.items_limit_message(user)
        await analysis.save()
        return

    try:
        # Same pipeline as the add-item form: the user's own folder, background removed
        upload_result = await upload_wardrobe_item(product_image_url, user_id)
        cloudinary_url = upload_result["url"]

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
            source_url=product_url,
            source_label=" ".join(
                part for part in (analysis.brand, metadata.get("subcategory") or "") if part
            ) or product_name,
            image_url=cloudinary_url,
            cloudinary_public_id=upload_result.get("public_id", ""),
        )
        await item.insert()

        analysis.wardrobe_item_id = item.id
        await analysis.save()

    except Exception as e:
        await usage_service.release(user, "items_added")
        import logging
        logging.getLogger(__name__).error(f"Auto-add to wardrobe failed: {e}")
