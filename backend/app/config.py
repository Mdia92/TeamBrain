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

    cors_origins: str = "http://localhost:3010,http://127.0.0.1:3010"
    csp_extra_connect_src: str = ""
    frontend_url: str = "http://localhost:3010"

    # Pilot gate (production defaults: code + @timtimol.sn only)
    pilot_mode: bool | None = None  # None → True when environment=production
    pilot_invite_code: str = "TIMTIMOL2026"
    pilot_email_domains: str = "timtimol.sn"

    # Optional Google OAuth (login only — no public signup via Google)
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = ""

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
    s3_region: str = "auto"
    s3_use_path_style: bool = False

    firebase_service_account_json: str = ""

    # PayDunya (Senegal / West Africa payments — leave empty until merchant account)
    paydunya_api_key: str = ""
    paydunya_master_key: str = ""
    paydunya_token: str = ""
    paydunya_mode: Literal["sandbox", "live"] = "sandbox"

    # Assistant personality (display name in prompts — set Xam for FR/Wolof orgs if desired)
    assistant_name: str = "Ask AI"
    assistant_personality: str = ""

    @property
    def google_oauth_redirect(self) -> str:
        if self.google_oauth_redirect_uri.strip():
            return self.google_oauth_redirect_uri.strip()
        return "http://127.0.0.1:8010/api/auth/google/callback"

    @property
    def pilot_mode_enabled(self) -> bool:
        if self.pilot_mode is not None:
            return self.pilot_mode
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]
        front = self.frontend_url.strip().rstrip("/")
        if front and front not in origins:
            origins.append(front)
        return origins

    @property
    def cookie_secure(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
