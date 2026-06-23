"""Daily status coordination."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.pagination import paginate_response
from app.trial import require_write_access

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
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    d = status_date or date.today()
    params: dict = {"oid": str(user["organization_id"]), "d": d, "lim": limit + 1}
    cursor_clause_sql = ""
    if cursor:
        from app.pagination import decode_cursor

        c = decode_cursor(cursor)
        cursor_clause_sql = " AND ds.id < CAST(:c_id AS uuid)"
        params["c_id"] = c["id"]
    rows = [
        dict(r)
        for r in (
            await session.execute(
                text(
                    "SELECT ds.id, ds.status_text, ds.location_name, ds.source, ds.date,"
                    " u.full_name AS user_name"
                    " FROM daily_status ds JOIN users u ON u.id = ds.user_id"
                    " WHERE ds.organization_id = CAST(:oid AS uuid) AND ds.date = :d"
                    f"{cursor_clause_sql} ORDER BY ds.id DESC LIMIT :lim"
                ).bindparams(**params),
            )
        ).mappings().all()
    ]
    page = paginate_response(rows, limit=limit, cursor_fields=["id"])
    page["date"] = str(d)
    return page


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_daily_status(
    body: DailyStatusIn,
    user: dict = Depends(require_write_access),
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
