from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.user import User
from app.models.item import WardrobeItem
from app.models.trip import Trip
from app.models.waitlist import WaitlistEntry
from app.models.daily import DailyLook
from app.models.look import Look
from app.models.purchase_analysis import PurchaseAnalysis


async def init_db():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DATABASE_NAME],
        document_models=[User, WardrobeItem, Trip, WaitlistEntry, DailyLook, Look, PurchaseAnalysis],
    )
