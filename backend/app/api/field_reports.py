"""Field reports API — delegates to unified documents module."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.documents import FieldReportIn, _insert_field_report, list_documents, map_field_reports
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.trial import require_write_access

router = APIRouter(prefix="/api/field-reports", tags=["field-reports"])


class FieldReportLegacyIn(BaseModel):
    project_id: str | None = None
    mission_date: date
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    report_type: str | None = None
    description: str | None = None
    photos: list[str] = Field(default_factory=list)
    structured_data: dict = Field(default_factory=dict)
    recommendations: str | None = None
    client_id: str | None = None


@router.get("")
async def list_field_reports(
    project_id: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await list_documents(
        project_id=project_id,
        doc_type="field_report",
        cursor=cursor,
        limit=limit,
        user=user,
        session=session,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_field_report(
    body: FieldReportLegacyIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    payload = FieldReportIn(
        project_id=body.project_id,
        mission_date=body.mission_date,
        location_name=body.location_name,
        latitude=body.latitude,
        longitude=body.longitude,
        description=body.description,
        photos=body.photos,
        client_id=body.client_id,
    )
    return await _insert_field_report(session, user, payload)


@router.get("/map")
async def map_view(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await map_field_reports(user=user, session=session)
