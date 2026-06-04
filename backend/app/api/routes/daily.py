from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_current_user
from app.models.user import User
from app.models.item import WardrobeItem
from app.models.daily import DailyLook, DailyOutfit, WornHistoryEntry
from app.services.weather_service import get_current_weather, get_weather_summary
from app.services.claude_service import generate_daily_outfits

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


class AnchorItemBody(BaseModel):
    item_id: str
    name: str = ""


class GenerateRequest(BaseModel):
    occasion: str
    mood: str
    vibe: Optional[str] = None
    context_note: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    anchor_items: List[AnchorItemBody] = []
    inspiration_image_urls: List[str] = []


class ChooseRequest(BaseModel):
    outfit_index: int


@router.post("/generate")
@limiter.limit("10/minute")
async def generate_look(
    request: Request,
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
):
    # Fetch wardrobe
    wardrobe = await WardrobeItem.find(WardrobeItem.user_id == current_user.id).to_list()
    wardrobe_list = [
        {
            "id": str(item.id),
            "name": item.name,
            "category": item.category,
            "color": item.color if isinstance(item.color, list) else [item.color],
            "fabric": item.fabric,
            "formality": item.formality,
            "occasions": item.occasions,
            "season": item.season,
            "image_url": item.image_url,
            "notes": item.notes,
        }
        for item in wardrobe
    ]

    # Weather
    weather = {}
    weather_summary = ""
    if body.lat is not None and body.lon is not None:
        weather = await get_current_weather(body.lat, body.lon)
        weather_summary = get_weather_summary(weather)
    else:
        weather = {"temp_c": 20, "feels_like_c": 20, "condition": "Clear", "rain_chance": 0}
        weather_summary = "20°C · Clear"

    # Worn history (last 30 entries)
    worn_history = [
        {
            "date": e.date,
            "look_id": e.look_id,
            "occasion": e.occasion,
            "vibe": e.vibe,
            "item_ids": e.item_ids,
            "weather_summary": e.weather_summary,
        }
        for e in (current_user.worn_history or [])[-30:]
    ]

    style_insights = {}
    if current_user.style_insights:
        si = current_user.style_insights
        style_insights = {
            "underused_item_ids": si.underused_item_ids,
            "skip_pattern_item_ids": si.skip_pattern_item_ids,
            "occasion_preferences": si.occasion_preferences,
            "vibe_correlations": si.vibe_correlations,
            "wear_frequency": si.wear_frequency,
        }

    context = {
        "occasion": body.occasion,
        "mood": body.mood,
        "vibe": body.vibe,
        "context_note": body.context_note,
        "weather": weather,
    }

    anchor_items = [{"item_id": a.item_id, "name": a.name} for a in body.anchor_items]

    preferences = current_user.preferences.model_dump() if current_user.preferences else {}
    style_dna = current_user.style_dna.model_dump() if current_user.style_dna else None

    try:
        result = await generate_daily_outfits(
            wardrobe=wardrobe_list,
            worn_history=worn_history,
            style_insights=style_insights,
            context=context,
            anchor_items=anchor_items,
            inspiration_image_urls=body.inspiration_image_urls,
            preferences=preferences,
            style_dna=style_dna,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stylist error: {str(e)}")

    raw_outfits = result.get("outfits", [])
    daily_outfits = []
    for o in raw_outfits:
        daily_outfits.append(
            DailyOutfit(
                outfit_index=o.get("outfit_index", len(daily_outfits)),
                item_ids=o.get("item_ids", []),
                item_names=o.get("item_names", []),
                item_image_urls=o.get("item_image_urls", []),
                claude_note=o.get("claude_note", ""),
                occasion_tags=o.get("occasion_tags", []),
            )
        )

    look = DailyLook(
        user_id=current_user.id,
        date=str(date.today()),
        occasion=body.occasion,
        mood=body.mood,
        vibe=body.vibe,
        weather_summary=weather_summary,
        generated_outfits=daily_outfits,
        status="generated",
        created_at=datetime.utcnow(),
    )
    await look.insert()

    return {
        "success": True,
        "data": {
            "look_id": str(look.id),
            "outfits": [o.model_dump() for o in daily_outfits],
            "weather_summary": weather_summary,
            "occasion": body.occasion,
            "mood": body.mood,
            "vibe": body.vibe,
        },
        "message": "",
    }


@router.post("/{look_id}/choose")
async def choose_outfit(
    look_id: str,
    body: ChooseRequest,
    current_user: User = Depends(get_current_user),
):
    look = await DailyLook.get(look_id)
    if not look:
        raise HTTPException(status_code=404, detail="Look not found")
    if str(look.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your look")

    if body.outfit_index < 0 or body.outfit_index >= len(look.generated_outfits):
        raise HTTPException(status_code=400, detail="Invalid outfit index")

    chosen = look.generated_outfits[body.outfit_index]
    look.chosen_outfit_index = body.outfit_index
    look.chosen_item_ids = chosen.item_ids
    look.status = "chosen"
    await look.save()

    # Append to worn history
    entry = WornHistoryEntry(
        date=look.date,
        look_id=str(look.id),
        occasion=look.occasion,
        vibe=look.vibe,
        item_ids=chosen.item_ids,
        weather_summary=look.weather_summary,
    )
    if current_user.worn_history is None:
        current_user.worn_history = []
    current_user.worn_history.append(entry)
    # Keep max 90 entries
    if len(current_user.worn_history) > 90:
        current_user.worn_history = current_user.worn_history[-90:]
    await current_user.save()

    return {"success": True, "data": look.model_dump(), "message": ""}


@router.get("/history")
async def get_history(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
):
    looks = (
        await DailyLook.find(DailyLook.user_id == current_user.id)
        .sort(-DailyLook.created_at)
        .skip(offset)
        .limit(limit)
        .to_list()
    )
    return {"success": True, "data": [l.model_dump() for l in looks], "message": ""}


@router.get("/today")
async def get_today(current_user: User = Depends(get_current_user)):
    today_str = str(date.today())
    look = await DailyLook.find_one(
        DailyLook.user_id == current_user.id,
        DailyLook.date == today_str,
    )
    if not look:
        return {"success": True, "data": None, "message": ""}

    return {"success": True, "data": look.model_dump(), "message": ""}


@router.get("/insights")
async def get_insights(current_user: User = Depends(get_current_user)):
    insights = current_user.style_insights
    return {
        "success": True,
        "data": insights.model_dump() if insights else {},
        "message": "",
    }
