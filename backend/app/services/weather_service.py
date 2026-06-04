import httpx
from app.core.config import settings


async def get_current_weather(lat: float, lon: float) -> dict:
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.OPENWEATHER_API_KEY,
        "units": "metric",
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=5.0)
            data = response.json()
        return {
            "temp_c": round(data["main"]["temp"]),
            "feels_like_c": round(data["main"]["feels_like"]),
            "condition": data["weather"][0]["description"].capitalize(),
            "rain_chance": round(data.get("clouds", {}).get("all", 0)),
            "icon": data["weather"][0]["icon"],
            "city": data.get("name", ""),
        }
    except Exception:
        return {
            "temp_c": 20,
            "feels_like_c": 20,
            "condition": "Clear",
            "rain_chance": 0,
            "icon": "01d",
            "city": "",
        }


def get_weather_summary(weather: dict) -> str:
    city = f" · {weather['city']}" if weather.get("city") else ""
    return f"{weather['temp_c']}°C · {weather['condition']}{city}"
