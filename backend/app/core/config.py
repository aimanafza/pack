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
    FAL_API_KEY: str = ""
    OPENWEATHER_API_KEY: str = ""

    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    WAITLIST_ADMIN_SECRET: str = ""
    WAITLIST_ADMIN_EMAIL: str = "aimanafzal47@gmail.com"
    EMAIL_FROM_USER: str = "hey@textpack.co"
    EMAIL_FROM_INTERNAL: str = "no-reply@textpack.co"
    CHROME_EXTENSION_ID: str = ""

    LINQ_API_TOKEN: str = ""
    LINQ_WEBHOOK_SECRET: str = ""
    LINQ_API_BASE_URL: str = "https://api.linqapp.com/api/partner/v3"

    # Voice note transcription — provider/model are config, not code, so
    # switching (e.g. to OpenAI) later is an env var change.
    TRANSCRIPTION_PROVIDER: str = "groq"
    TRANSCRIPTION_MODEL: str = "whisper-large-v3"
    GROQ_API_KEY: str = ""

    class Config:
        env_file = ".env"
        env_ignore_empty = True
        extra = "ignore"


settings = Settings()
