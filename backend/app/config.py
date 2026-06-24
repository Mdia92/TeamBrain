"""Application settings — Supabase as managed PostgreSQL only."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = ""
    environment: Literal["development", "production"] = "development"

    jwt_secret_key: str = "change_me_in_production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    app_db_role: str = "coord_app"

    cors_origins: str = "http://localhost:3010"
    csp_extra_connect_src: str = ""
    frontend_url: str = "http://localhost:3010"
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8010/api/auth/google/callback"

    gemini_api_key: str = ""
    groq_api_key: str = ""
    mistral_api_key: str = ""
    openai_api_key: str = ""
    deepgram_api_key: str = ""

    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_whatsapp_number: str | None = None

    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = ""

    firebase_service_account_json: str = ""

    # PayDunya (Senegal / West Africa payments — leave empty until merchant account)
    paydunya_api_key: str = ""
    paydunya_master_key: str = ""
    paydunya_token: str = ""
    paydunya_mode: Literal["sandbox", "live"] = "sandbox"

    # Assistant personality (Xam = « savoir » en wolof)
    assistant_name: str = "Xam"
    assistant_personality: str = ""

    # Local demo seed only — never commit real values (set in .env)
    seed_demo_email: str = "amadou@timtimol.sn"
    seed_demo_password: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cookie_secure(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
