import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, wardrobe, trips, pack, inspiration, profile, avatar, waitlist


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="PACK API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
