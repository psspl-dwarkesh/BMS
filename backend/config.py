"""
Application configuration — loaded from environment variables / .env file.

All other modules should import `settings` from here rather than reading
os.environ directly, so there is one canonical place to see every knob.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-use-a-32-byte-random-hex"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins, e.g.
    # CORS_ORIGINS=http://localhost:5173,https://bms.example.com
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./bms_analytics.db"

    # ── Simulator ─────────────────────────────────────────────────────────────
    SIMULATOR_ENABLED: bool = True
    SIMULATOR_TICK_SECONDS: float = 5.0


settings = Settings()
