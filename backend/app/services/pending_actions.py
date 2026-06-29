"""Pending AI action suggestions — admin approval gate."""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.delivery.whatsapp import whatsapp_client


async def create_pending_action(
    session: AsyncSession,
    *,
    org_id: str,
    action_type: str,
    payload: dict[str, Any],
    suggested_by: str = "assistant",
) -> str:
    action_id = str(uuid.uuid4())
    await session.execute(
        text(
            "INSERT INTO pending_actions (id, organization_id, action_type, payload, suggested_by, status)"
            " VALUES (CAST(:id AS uuid), CAST(:oid AS uuid), :atype, CAST(:payload AS jsonb), :sby, 'pending')"
        ).bindparams(
            id=action_id,
            oid=org_id,
            atype=action_type,
            payload=json.dumps(payload),
            sby=suggested_by,
        ),
    )
    await session.commit()
    return action_id


async def list_pending_actions(session: AsyncSession, org_id: str, *, limit: int = 50) -> list[dict]:
    rows = (
        await session.execute(
            text(
                "SELECT id, action_type, payload, suggested_by, status, created_at"
                " FROM pending_actions"
                " WHERE organization_id = CAST(:oid AS uuid) AND status = 'pending'"
                " ORDER BY created_at DESC LIMIT :lim"
            ).bindparams(oid=org_id, lim=limit),
        )
    ).mappings().all()
    return [
        {**dict(r), "created_at": r["created_at"].isoformat() if r.get("created_at") else None}
        for r in rows
    ]


async def count_pending_actions(session: AsyncSession, org_id: str) -> int:
    return int(
        (
            await session.execute(
                text(
                    "SELECT COUNT(*) FROM pending_actions"
                    " WHERE organization_id = CAST(:oid AS uuid) AND status = 'pending'"
                ).bindparams(oid=org_id),
            )
        ).scalar()
        or 0
    )


async def _execute_action(
    session: AsyncSession,
    org_id: str,
    user_id: str,
    action_type: str,
    payload: dict[str, Any],
) -> str:
    if action_type in ("create_task", "task_suggestion"):
        tid = uuid.uuid4()
        pid = payload.get("project_id")
        if not pid:
            row = (
                await session.execute(
                    text("SELECT id FROM projects WHERE organization_id = CAST(:oid AS uuid) LIMIT 1").bindparams(
                        oid=org_id
                    ),
                )
            ).first()
            pid = str(row[0]) if row else None
        await session.execute(
            text(
                "INSERT INTO tasks (id, organization_id, project_id, title, status, source, created_by)"
                " VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, 'todo',"
                " 'assistant', CAST(:uid AS uuid))"
            ).bindparams(
                tid=str(tid),
                oid=org_id,
                pid=pid,
                title=payload.get("title", "Tâche suggérée"),
                uid=user_id,
            ),
        )
        brain = MemoryService(session)
        await brain.write_memory(
            org_id=org_id,
            type="episodic",
            entity_type="task",
            entity_id=str(tid),
            note=f"Tâche créée (approbation): {payload.get('title')}",
            source_module="assistant",
            source_id=str(tid),
        )
        return str(tid)

    if action_type == "whatsapp_send":
        recipient = payload.get("recipient_email") or payload.get("recipient_name", "")
        message = payload.get("message", "")
        if recipient:
            whatsapp_client.send_message(recipient, message)
        return "whatsapp_sent"

    if action_type == "update_task_status":
        await session.execute(
            text(
                "UPDATE tasks SET status = :status WHERE id = CAST(:tid AS uuid)"
                " AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(
                status=payload.get("status"),
                tid=payload.get("task_id"),
                oid=org_id,
            ),
        )
        return str(payload.get("task_id"))

    if action_type == "add_memory":
        brain = MemoryService(session)
        memory_id = await brain.write_memory(
            org_id=org_id,
            type=payload.get("memory_type", "episodic"),
            entity_type=payload.get("entity_type", "message"),
            entity_id=payload.get("entity_id"),
            note=payload.get("note", ""),
            source_module=payload.get("source_module", "automation"),
            source_id=payload.get("entity_id"),
        )
        return memory_id

    raise ValueError(f"Type d'action non supporté: {action_type}")


async def approve_pending_action(
    session: AsyncSession,
    *,
    org_id: str,
    action_id: str,
    reviewer_id: str,
) -> dict:
    row = (
        await session.execute(
            text(
                "SELECT action_type, payload, status FROM pending_actions"
                " WHERE id = CAST(:id AS uuid) AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(id=action_id, oid=org_id),
        )
    ).mappings().first()
    if not row:
        raise ValueError("Action introuvable")
    if row["status"] != "pending":
        raise ValueError("Action déjà traitée")
    payload = row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"] or "{}")
    result_id = await _execute_action(session, org_id, reviewer_id, row["action_type"], payload)
    await session.execute(
        text(
            "UPDATE pending_actions SET status = 'approved', reviewed_by = CAST(:uid AS uuid),"
            " reviewed_at = now() WHERE id = CAST(:id AS uuid)"
        ).bindparams(uid=reviewer_id, id=action_id),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=org_id,
        type="episodic",
        entity_type="message",
        entity_id=action_id,
        note=f"Action approuvée: {row['action_type']} → {result_id}",
        source_module="assistant",
        source_id=action_id,
    )
    await session.commit()
    return {"status": "approved", "result_id": result_id}


async def reject_pending_action(
    session: AsyncSession,
    *,
    org_id: str,
    action_id: str,
    reviewer_id: str,
) -> dict:
    row = (
        await session.execute(
            text(
                "SELECT action_type, status FROM pending_actions"
                " WHERE id = CAST(:id AS uuid) AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(id=action_id, oid=org_id),
        )
    ).mappings().first()
    if not row:
        raise ValueError("Action introuvable")
    if row["status"] != "pending":
        raise ValueError("Action déjà traitée")
    await session.execute(
        text(
            "UPDATE pending_actions SET status = 'rejected', reviewed_by = CAST(:uid AS uuid),"
            " reviewed_at = now() WHERE id = CAST(:id AS uuid)"
        ).bindparams(uid=reviewer_id, id=action_id),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=org_id,
        type="episodic",
        entity_type="message",
        entity_id=action_id,
        note=f"Action rejetée: {row['action_type']}",
        source_module="assistant",
        source_id=action_id,
    )
    await session.commit()
    return {"status": "rejected"}
