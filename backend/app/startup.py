"""Startup checks — pgvector extension."""

from __future__ import annotations

import structlog
from sqlalchemy import text

from app.db.session import engine

log = structlog.get_logger("teambrain.startup")


async def ensure_pgvector() -> None:
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        log.info("pgvector_ready")
    except Exception:
        log.warning("pgvector_check_failed", exc_info=True)
