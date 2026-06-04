from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, wardrobe, trips, pack, inspiration, profile, avatar, waitlist
from app.api.routes.daily import router as daily_router
from app.api.routes.weather import router as weather_router
from app.api.routes.looks import router as looks_router
from app.api.routes.uploads import router as uploads_router
from app.api.routes.purchase_analysis import router as purchase_analysis_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="PACK API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"chrome-extension://.*",  # allow all PACK extension IDs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(waitlist.router, prefix="/waitlist", tags=["waitlist"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(wardrobe.router, prefix="/api/v1/wardrobe", tags=["wardrobe"])
app.include_router(trips.router, prefix="/api/v1/trips", tags=["trips"])
app.include_router(pack.router, prefix="/api/v1/pack", tags=["pack"])
app.include_router(inspiration.router, prefix="/api/v1/trips", tags=["inspiration"])
app.include_router(profile.router, prefix="/api/v1/profile", tags=["profile"])
app.include_router(avatar.router, prefix="/api/v1/users", tags=["avatar"])
app.include_router(daily_router, prefix="/api/v1/daily", tags=["daily"])
app.include_router(weather_router, prefix="/api/v1/weather", tags=["weather"])
app.include_router(looks_router, prefix="/api/v1/looks", tags=["looks"])
app.include_router(uploads_router, prefix="/api/v1/uploads", tags=["uploads"])
app.include_router(purchase_analysis_router, prefix="/api/v1/purchase-analysis", tags=["purchase-analysis"])
