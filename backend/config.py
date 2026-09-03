"""
Application configuration — loaded from environment variables / .env file.

All other modules should import `settings` from here rather than reading
os.environ directly, so there is one canonical place to see every knob.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULT_SECRET_KEY = "change-me-in-production-use-a-32-byte-random-hex"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Environment ──────────────────────────────────────────────────────────
    # "development" is the only value that tolerates the insecure default
    # SECRET_KEY below - set ENVIRONMENT=production (Render's envVars, Neon
    # deploy, etc.) to make an unset/default SECRET_KEY a hard startup error
    # instead of silently signing real JWTs with a value visible in this repo.
    ENVIRONMENT: str = "development"

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = _INSECURE_DEFAULT_SECRET_KEY
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

if settings.ENVIRONMENT != "development" and settings.SECRET_KEY == _INSECURE_DEFAULT_SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is unset (still the insecure placeholder) while ENVIRONMENT="
        f"{settings.ENVIRONMENT!r}. Refusing to start: this would sign real JWTs "
        "with a value visible in the public source. Set a real random SECRET_KEY "
        "(e.g. `python -c \"import secrets; print(secrets.token_hex(32))\"`) via "
        "the environment or .env file."
    )
