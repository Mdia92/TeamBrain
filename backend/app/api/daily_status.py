"""Daily status coordination."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/daily-status", tags=["daily-status"])


class DailyStatusIn(BaseModel):
    status_text: str = Field(min_length=1)
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    project_id: str | None = None
    source: str = "app"


@router.get("")
async def list_daily_status(
    status_date: date | None = None,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    d = status_date or date.today()
    rows = (
        await session.execute(
            text(
                "SELECT ds.id, ds.status_text, ds.location_name, ds.source, ds.date,"
                " u.full_name AS user_name"
                " FROM daily_status ds JOIN users u ON u.id = ds.user_id"
                " WHERE ds.organization_id = CAST(:oid AS uuid) AND ds.date = :d"
                " ORDER BY ds.id DESC"
            ).bindparams(oid=str(user["organization_id"]), d=d),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "date": str(d)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_daily_status(
    body: DailyStatusIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    await session.execute(
        text(
            "INSERT INTO daily_status (id, organization_id, user_id, date, status_text,"
            " location_name, latitude, longitude, source, project_id)"
            " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:uid AS uuid), CURRENT_DATE,"
            " :text, :loc, :lat, :lng, :source, CAST(:pid AS uuid))"
        ).bindparams(
            oid=str(user["organization_id"]),
            uid=str(user["id"]),
            text=body.status_text,
            loc=body.location_name,
            lat=body.latitude,
            lng=body.longitude,
            source=body.source,
            pid=body.project_id,
        ),
    )
    await session.commit()
    return {"status": "submitted"}
