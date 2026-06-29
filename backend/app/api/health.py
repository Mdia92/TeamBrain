"""Health check."""

from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import SessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/api/health")
async def health() -> dict:
    payload: dict = {"status": "ok", "service": "teambrain-api"}
    try:
        async with SessionLocal() as session:
            row = (
                await session.execute(
                    text(
                        "SELECT version_num FROM alembic_version LIMIT 1"
                    ),
                )
            ).scalar()
            if row:
                payload["db_migration"] = row
            has_memberships = (
                await session.execute(
                    text(
                        "SELECT EXISTS ("
                        " SELECT 1 FROM information_schema.tables"
                        " WHERE table_schema = 'public' AND table_name = 'org_memberships'"
                        ")"
                    ),
                )
            ).scalar()
            payload["org_memberships_table"] = bool(has_memberships)
    except Exception as exc:
        payload["db_check"] = "failed"
        payload["db_error"] = type(exc).__name__
    return payload
