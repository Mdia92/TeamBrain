"""Organization-wide activity notifications and revision bump for live sync."""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.sql_compat import is_sqlite, settings_column
from app.delivery.push import send_push


async def _bump_activity_revision(session: AsyncSession, org_id: str) -> int:
    if is_sqlite():
        row = (
            await session.execute(
                text("SELECT settings FROM organizations WHERE id = :oid").bindparams(oid=org_id),
            )
        ).mappings().first()
    else:
        row = (
            await session.execute(
                text("SELECT settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                    oid=org_id,
                ),
            )
        ).mappings().first()
    settings: dict[str, Any] = {}
    if row and row.get("settings"):
        raw = row["settings"]
        settings = json.loads(raw) if isinstance(raw, str) else dict(raw)
    revision = int(settings.get("activity_revision", 0)) + 1
    settings["activity_revision"] = revision
    if is_sqlite():
        await session.execute(
            text("UPDATE organizations SET settings = :s WHERE id = :oid").bindparams(
                s=json.dumps(settings),
                oid=org_id,
            ),
        )
    else:
        await session.execute(
            text(f"UPDATE organizations SET settings = {settings_column()} WHERE id = CAST(:oid AS uuid)").bindparams(
                settings=json.dumps(settings),
                oid=org_id,
            ),
        )
    return revision


async def _active_member_ids(session: AsyncSession, org_id: str) -> list[str]:
    if is_sqlite():
        rows = (
            await session.execute(
                text(
                    "SELECT user_id FROM org_memberships WHERE organization_id = :oid AND is_active = 1"
                ).bindparams(oid=org_id),
            )
        ).scalars().all()
    else:
        rows = (
            await session.execute(
                text(
                    "SELECT user_id::text FROM org_memberships"
                    " WHERE organization_id = CAST(:oid AS uuid) AND is_active = true"
                ).bindparams(oid=org_id),
            )
        ).scalars().all()
    return [str(r) for r in rows]


async def broadcast_org_activity(
    session: AsyncSession,
    *,
    org_id: str,
    actor_id: str,
    module: str,
    action: str,
    title: str,
    body: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    link_path: str | None = None,
    extra_user_ids: list[str] | None = None,
) -> int:
    """Notify all active org members (in-app + push when configured)."""
    revision = await _bump_activity_revision(session, org_id)
    targets = set(await _active_member_ids(session, org_id))
    if extra_user_ids:
        targets.update(extra_user_ids)

    for uid in targets:
        nid = str(uuid.uuid4())
        if is_sqlite():
            await session.execute(
                text(
                    "INSERT INTO org_notifications"
                    " (id, organization_id, user_id, module, action, title, body,"
                    " entity_type, entity_id, link_path, created_at)"
                    " VALUES (:id, :oid, :uid, :mod, :act, :title, :body,"
                    " :etype, :eid, :link, datetime('now'))"
                ).bindparams(
                    id=nid,
                    oid=org_id,
                    uid=uid,
                    mod=module,
                    act=action,
                    title=title,
                    body=body,
                    etype=entity_type,
                    eid=entity_id,
                    link=link_path,
                ),
            )
        else:
            await session.execute(
                text(
                    "INSERT INTO org_notifications"
                    " (id, organization_id, user_id, module, action, title, body,"
                    " entity_type, entity_id, link_path)"
                    " VALUES (CAST(:id AS uuid), CAST(:oid AS uuid), CAST(:uid AS uuid),"
                    " :mod, :act, :title, :body, :etype,"
                    " CASE WHEN :eid IS NULL THEN NULL ELSE CAST(:eid AS uuid) END, :link)"
                ).bindparams(
                    id=nid,
                    oid=org_id,
                    uid=uid,
                    mod=module,
                    act=action,
                    title=title,
                    body=body,
                    etype=entity_type,
                    eid=entity_id,
                    link=link_path,
                ),
            )
        if uid != actor_id:
            await send_push(
                session,
                user_id=uid,
                title=title,
                body=body,
                data={
                    "module": module,
                    "action": action,
                    "entity_type": entity_type or "",
                    "entity_id": entity_id or "",
                    "link_path": link_path or "",
                    "revision": str(revision),
                },
            )

    return revision


async def get_activity_revision(session: AsyncSession, org_id: str) -> int:
    if is_sqlite():
        row = (
            await session.execute(
                text("SELECT settings FROM organizations WHERE id = :oid").bindparams(oid=org_id),
            )
        ).mappings().first()
    else:
        row = (
            await session.execute(
                text("SELECT settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                    oid=org_id,
                ),
            )
        ).mappings().first()
    if not row or not row.get("settings"):
        return 0
    raw = row["settings"]
    settings = json.loads(raw) if isinstance(raw, str) else dict(raw)
    return int(settings.get("activity_revision", 0))
