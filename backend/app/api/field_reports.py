"""Field reports API — offline sync support."""

from __future__ import annotations

import json
import uuid
from datetime import date

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/field-reports", tags=["field-reports"])


class FieldReportIn(BaseModel):
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
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    query = (
        "SELECT id, project_id, mission_date, location_name, latitude, longitude,"
        " report_type, description, ai_summary, recommendations, synced_at, created_at"
        " FROM field_reports WHERE organization_id = CAST(:oid AS uuid)"
    )
    params = {"oid": str(user["organization_id"])}
    if project_id:
        query += " AND project_id = CAST(:pid AS uuid)"
        params["pid"] = project_id
    query += " ORDER BY mission_date DESC"
    rows = (await session.execute(text(query).bindparams(**params))).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_field_report(
    body: FieldReportIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rid = uuid.uuid4()
    summary = ""
    if body.description:
        summary, _ = await generate_text(
            f"Résume en 3 phrases ce rapport terrain:\n{body.description}",
            "Assistant terrain.",
        )

    await session.execute(
        text(
            "INSERT INTO field_reports (id, organization_id, project_id, submitted_by,"
            " mission_date, location_name, latitude, longitude, report_type, description,"
            " photos, structured_data, ai_summary, recommendations, synced_at)"
            " VALUES (CAST(:rid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid),"
            " CAST(:uid AS uuid), :mdate, :loc, :lat, :lng, :rtype, :desc,"
            " CAST(:photos AS jsonb), CAST(:sdata AS jsonb), :summary, :rec, now())"
        ).bindparams(
            rid=str(rid),
            oid=str(user["organization_id"]),
            pid=body.project_id,
            uid=str(user["id"]),
            mdate=body.mission_date,
            loc=body.location_name,
            lat=body.latitude,
            lng=body.longitude,
            rtype=body.report_type,
            desc=body.description,
            photos=json.dumps(body.photos),
            sdata=json.dumps(body.structured_data),
            summary=summary,
            rec=body.recommendations,
        ),
    )
    await session.commit()

    if summary or body.description:
        loc = body.location_name or "terrain"
        note = f"{summary or body.description} [{loc}]"
        brain = MemoryService(session)
        await brain.write_memory(
            org_id=str(user["organization_id"]),
            type="episodic",
            entity_type="field_report",
            entity_id=str(rid),
            note=note,
            source_module="field_reports",
            source_id=str(rid),
        )
        await session.commit()

    return {"id": str(rid), "ai_summary": summary}


@router.get("/map")
async def map_view(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT id, location_name, latitude, longitude, mission_date, report_type"
                " FROM field_reports WHERE organization_id = CAST(:oid AS uuid)"
                " AND latitude IS NOT NULL AND longitude IS NOT NULL"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"points": [dict(r) for r in rows]}
