from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str
    DATABASE_NAME: str = "pack_db"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080
    # Optional until wardrobe/pack routes are built
    ANTHROPIC_API_KEY: str = ""
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    FAL_API_KEY: str = ""
    OPENWEATHER_API_KEY: str = ""

    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    WAITLIST_ADMIN_SECRET: str = ""
    WAITLIST_ADMIN_EMAIL: str = "aimanafzal47@gmail.com"
    EMAIL_FROM_USER: str = "hey@textpack.co"
    EMAIL_FROM_INTERNAL: str = "no-reply@textpack.co"

    class Config:
        env_file = ".env"
        env_ignore_empty = True
        extra = "ignore"


settings = Settings()
