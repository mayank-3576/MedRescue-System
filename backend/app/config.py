from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    APP_NAME: str = "MedRescue System Backend"
    APP_ENV: str = "development"
    DEBUG: str = "true"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    DATABASE_URL: str = "sqlite:///./medrescue.db"

    SECRET_KEY: str = "medrescue_super_secret_jwt_key_change_in_production_2026_secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    DEFAULT_DELIVERY_COST_PER_KM: float = 15.0
    DEFAULT_FIXED_DELIVERY_CHARGE: float = 500.0
    MIN_SHELF_LIFE_DAYS: int = 30
    MAX_DELIVERY_RADIUS_KM: float = 800.0
    OSRM_ROUTING_URL: str = "http://router.project-osrm.org"

    EXPLAINER_PROVIDER: str = "rules"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4.1-mini"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    # Razorpay credentials stay server-side. Without them, checkout is disabled.
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    @property
    def is_debug(self) -> bool:
        return self.DEBUG.lower() in ("true", "1", "yes")

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
