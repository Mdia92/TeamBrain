"""Offline sync queue API."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.trial import require_write_access

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncItem(BaseModel):
    entity_type: str
    client_id: str
    payload: dict = Field(default_factory=dict)


class SyncPushIn(BaseModel):
    items: list[SyncItem]


async def _apply_field_report(session: AsyncSession, user: dict, p: dict) -> None:
    await session.execute(
        text(
            "INSERT INTO field_reports (id, organization_id, project_id, submitted_by,"
            " mission_date, location_name, latitude, longitude, description, photos, synced_at)"
            " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:pid AS uuid),"
            " CAST(:uid AS uuid), CAST(:mdate AS date), :loc, :lat, :lng, :desc,"
            " CAST(:photos AS jsonb), now())"
        ).bindparams(
            oid=str(user["organization_id"]),
            pid=p.get("project_id"),
            uid=str(user["id"]),
            mdate=p.get("mission_date"),
            loc=p.get("location_name"),
            lat=p.get("latitude"),
            lng=p.get("longitude"),
            desc=p.get("description"),
            photos=json.dumps(p.get("photos") or []),
        ),
    )


async def _apply_task_create(session: AsyncSession, user: dict, p: dict) -> str:
    tid = uuid.uuid4()
    await session.execute(
        text(
            "INSERT INTO tasks (id, organization_id, project_id, title, description,"
            " assignee_id, due_date, priority, status, source, created_by)"
            " VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, :desc,"
            " CAST(:aid AS uuid), CAST(:due AS date), :priority, :status, 'manual', CAST(:uid AS uuid))"
        ).bindparams(
            tid=str(tid),
            oid=str(user["organization_id"]),
            pid=p.get("project_id"),
            title=p.get("title"),
            desc=p.get("description"),
            aid=p.get("assignee_id"),
            due=p.get("due_date"),
            priority=p.get("priority", "medium"),
            status=p.get("status", "todo"),
            uid=str(user["id"]),
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=str(user["organization_id"]),
        type="episodic",
        entity_type="task",
        entity_id=str(tid),
        note=f"Tâche créée (sync): {p.get('title')}",
        source_module="tasks",
        source_id=str(tid),
    )
    return str(tid)


async def _apply_task_status(session: AsyncSession, user: dict, p: dict) -> None:
    task_id = p.get("task_id")
    await session.execute(
        text(
            "UPDATE tasks SET status = :status, updated_at = now()"
            " WHERE id = CAST(:tid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(
            status=p.get("status"),
            tid=task_id,
            oid=str(user["organization_id"]),
        ),
    )


async def _apply_project_create(session: AsyncSession, user: dict, p: dict) -> str:
    pid = uuid.uuid4()
    oid = str(user["organization_id"])
    await session.execute(
        text(
            "INSERT INTO projects (id, organization_id, name, client_name, description, status, created_by)"
            " VALUES (CAST(:pid AS uuid), CAST(:oid AS uuid), :name, :client, :desc, :status, CAST(:uid AS uuid))"
        ).bindparams(
            pid=str(pid),
            oid=oid,
            name=p.get("name"),
            client=p.get("client_name"),
            desc=p.get("description"),
            status=p.get("status", "active"),
            uid=str(user["id"]),
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="project",
        entity_id=str(pid),
        note=f"Projet créé (sync): {p.get('name')}",
        source_module="projects",
        source_id=str(pid),
    )
    return str(pid)


async def _apply_message_create(session: AsyncSession, user: dict, p: dict) -> str:
    mid = uuid.uuid4()
    oid = str(user["organization_id"])
    await session.execute(
        text(
            "INSERT INTO messages (id, organization_id, channel_id, sender_id, content)"
            " VALUES (CAST(:mid AS uuid), CAST(:oid AS uuid), CAST(:cid AS uuid),"
            " CAST(:uid AS uuid), :content)"
        ).bindparams(
            mid=str(mid),
            oid=oid,
            cid=p.get("channel_id"),
            uid=str(user["id"]),
            content=p.get("content"),
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="message",
        entity_id=str(mid),
        note=f"Message (sync): {(p.get('content') or '')[:80]}",
        source_module="messages",
        source_id=str(mid),
    )
    return str(mid)


async def _apply_calendar_event(session: AsyncSession, user: dict, p: dict) -> str:
    eid = uuid.uuid4()
    await session.execute(
        text(
            "INSERT INTO events (id, organization_id, title, project_id, event_type,"
            " start_datetime, end_datetime, location, description, created_by)"
            " VALUES (CAST(:eid AS uuid), CAST(:oid AS uuid), :title, CAST(:pid AS uuid),"
            " :etype, CAST(:start AS timestamptz), CAST(:end AS timestamptz), :loc, :desc, CAST(:uid AS uuid))"
        ).bindparams(
            eid=str(eid),
            oid=str(user["organization_id"]),
            title=p.get("title"),
            pid=p.get("project_id"),
            etype=p.get("event_type", "meeting"),
            start=p.get("start_datetime"),
            end=p.get("end_datetime"),
            loc=p.get("location"),
            desc=p.get("description"),
            uid=str(user["id"]),
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=str(user["organization_id"]),
        type="episodic",
        entity_type="message",
        entity_id=str(eid),
        note=f"Événement (sync): {p.get('title')}",
        source_module="calendar",
        source_id=str(eid),
    )
    return str(eid)


@router.post("/push", status_code=status.HTTP_201_CREATED)
async def sync_push(
    body: SyncPushIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    synced = []
    for item in body.items:
        existing = (
            await session.execute(
                text(
                    "SELECT id FROM sync_queue WHERE client_id = :cid AND user_id = CAST(:uid AS uuid)"
                ).bindparams(cid=item.client_id, uid=str(user["id"])),
            )
        ).first()
        if existing:
            synced.append({"client_id": item.client_id, "status": "already_synced"})
            continue

        p = {k: v for k, v in item.payload.items() if not k.startswith("_")}

        if item.entity_type == "field_report":
            await _apply_field_report(session, user, p)
        elif item.entity_type == "task_create":
            await _apply_task_create(session, user, p)
        elif item.entity_type == "task_status":
            await _apply_task_status(session, user, p)
        elif item.entity_type == "project_create":
            await _apply_project_create(session, user, p)
        elif item.entity_type == "message_create":
            await _apply_message_create(session, user, p)
        elif item.entity_type == "calendar_event":
            await _apply_calendar_event(session, user, p)
        else:
            synced.append({"client_id": item.client_id, "status": "unsupported"})
            continue

        await session.execute(
            text(
                "INSERT INTO sync_queue (id, organization_id, user_id, entity_type, client_id, payload)"
                " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:uid AS uuid), :etype, :cid,"
                " CAST(:payload AS jsonb))"
            ).bindparams(
                oid=str(user["organization_id"]),
                uid=str(user["id"]),
                etype=item.entity_type,
                cid=item.client_id,
                payload=json.dumps(item.payload),
            ),
        )
        synced.append({"client_id": item.client_id, "status": "synced"})

    await session.commit()
    return {"synced": synced, "pending_count": 0}


@router.get("/status")
async def sync_status(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    count = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM sync_queue WHERE user_id = CAST(:uid AS uuid) AND status = 'pending'"
            ).bindparams(uid=str(user["id"])),
        )
    ).scalar() or 0
    return {"pending_count": count}
