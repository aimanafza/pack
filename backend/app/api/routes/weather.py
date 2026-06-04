from fastapi import APIRouter
from app.services.weather_service import get_current_weather, get_weather_summary

router = APIRouter()


@router.get("/current")
async def current_weather(lat: float, lon: float):
    weather = await get_current_weather(lat, lon)
    return {
        "success": True,
        "data": {**weather, "summary": get_weather_summary(weather)},
        "message": "",
    }
