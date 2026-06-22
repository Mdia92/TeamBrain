"""Calendar API — events, conflict detection, iCal export."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


class EventIn(BaseModel):
    title: str = Field(min_length=1)
    project_id: str | None = None
    event_type: str = "meeting"
    start_datetime: datetime
    end_datetime: datetime
    location: str | None = None
    description: str | None = None
    attendee_ids: list[str] = Field(default_factory=list)


@router.get("/events")
async def list_events(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT e.id, e.title, e.project_id, e.event_type, e.start_datetime,"
                " e.end_datetime, e.location, e.description"
                " FROM events e WHERE e.organization_id = CAST(:oid AS uuid)"
                " ORDER BY e.start_datetime"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    conflicts = []
    for aid in body.attendee_ids:
        conflict = (
            await session.execute(
                text(
                    "SELECT e.title, e.start_datetime, e.end_datetime FROM events e"
                    " JOIN event_attendees ea ON ea.event_id = e.id"
                    " WHERE ea.user_id = CAST(:uid AS uuid)"
                    " AND e.start_datetime < :end AND e.end_datetime > :start"
                ).bindparams(uid=aid, start=body.start_datetime, end=body.end_datetime),
            )
        ).mappings().first()
        if conflict:
            conflicts.append(dict(conflict))

    eid = uuid.uuid4()
    await session.execute(
        text(
            "INSERT INTO events (id, organization_id, title, project_id, event_type,"
            " start_datetime, end_datetime, location, description, created_by)"
            " VALUES (CAST(:eid AS uuid), CAST(:oid AS uuid), :title, CAST(:pid AS uuid),"
            " :etype, :start, :end, :loc, :desc, CAST(:uid AS uuid))"
        ).bindparams(
            eid=str(eid),
            oid=str(user["organization_id"]),
            title=body.title,
            pid=body.project_id,
            etype=body.event_type,
            start=body.start_datetime,
            end=body.end_datetime,
            loc=body.location,
            desc=body.description,
            uid=str(user["id"]),
        ),
    )
    for aid in body.attendee_ids:
        await session.execute(
            text(
                "INSERT INTO event_attendees (id, event_id, user_id)"
                " VALUES (gen_random_uuid(), CAST(:eid AS uuid), CAST(:aid AS uuid))"
            ).bindparams(eid=str(eid), aid=aid),
        )
    await session.commit()
    return {"id": str(eid), "conflicts": conflicts}


@router.get("/export.ics")
async def export_ical(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    rows = (
        await session.execute(
            text(
                "SELECT title, start_datetime, end_datetime, location, description"
                " FROM events WHERE organization_id = CAST(:oid AS uuid)"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()

    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Coord//FR"]
    for i, ev in enumerate(rows):
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{i}@coord",
                f"SUMMARY:{ev['title']}",
                f"DTSTART:{ev['start_datetime'].strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{ev['end_datetime'].strftime('%Y%m%dT%H%M%SZ')}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return Response("\n".join(lines), media_type="text/calendar")
