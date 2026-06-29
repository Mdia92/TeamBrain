"""Startup checks — pgvector, production security gates."""

from __future__ import annotations

import structlog
from sqlalchemy import text

from app.config import settings
from app.db.session import engine

log = structlog.get_logger("teambrain.startup")

_WEAK_JWT = frozenset({"", "change_me_in_production", "changeme", "secret"})


def validate_production_settings() -> None:
    """Fail fast when production is misconfigured."""
    if settings.environment != "production":
        return
    secret = (settings.jwt_secret_key or "").strip()
    if secret in _WEAK_JWT or len(secret) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY must be a strong secret (≥32 chars) in production — "
            "generate: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
    if not (settings.pilot_invite_code or "").strip():
        raise RuntimeError("PILOT_INVITE_CODE must be set in production")
    if settings.paydunya_mode == "sandbox" and settings.paydunya_api_key:
        log.warning("paydunya_sandbox_in_production")


async def ensure_pgvector() -> None:
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        log.info("pgvector_ready")
    except Exception:
        log.warning("pgvector_check_failed", exc_info=True)
