"""Offline sync queue API."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncItem(BaseModel):
    entity_type: str
    client_id: str
    payload: dict = Field(default_factory=dict)


class SyncPushIn(BaseModel):
    items: list[SyncItem]


@router.post("/push", status_code=status.HTTP_201_CREATED)
async def sync_push(
    body: SyncPushIn,
    user: dict = Depends(get_current_user),
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

        if item.entity_type == "field_report":
            p = item.payload
            await session.execute(
                text(
                    "INSERT INTO field_reports (id, organization_id, project_id, submitted_by,"
                    " mission_date, location_name, latitude, longitude, description, synced_at)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:pid AS uuid),"
                    " CAST(:uid AS uuid), CAST(:mdate AS date), :loc, :lat, :lng, :desc, now())"
                ).bindparams(
                    oid=str(user["organization_id"]),
                    pid=p.get("project_id"),
                    uid=str(user["id"]),
                    mdate=p.get("mission_date"),
                    loc=p.get("location_name"),
                    lat=p.get("latitude"),
                    lng=p.get("longitude"),
                    desc=p.get("description"),
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
