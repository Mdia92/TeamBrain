"""Execute approved meeting_suggestion pending actions."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService


async def execute_meeting_suggestion(
    session: AsyncSession,
    *,
    org_id: str,
    user_id: str,
    payload: dict[str, Any],
) -> str:
    """Create meeting + tasks when admin approves a meeting_suggestion."""
    mid = str(uuid.uuid4())
    title = f"Réunion WhatsApp — {(payload.get('sender_name') or 'groupe')[:40]}"
    summary = payload.get("summary") or payload.get("dashboard_message") or title

    await session.execute(
        text(
            "INSERT INTO meetings (id, organization_id, title, date, transcript_text, ai_summary,"
            " platform_source, processing_status, created_by)"
            " VALUES (CAST(:mid AS uuid), CAST(:oid AS uuid), :title, CURRENT_DATE, :transcript, :summary,"
            " 'whatsapp_group', 'completed', CAST(:uid AS uuid))"
        ).bindparams(
            mid=mid,
            oid=org_id,
            title=title,
            transcript=payload.get("transcript_snippet", "")[:50000],
            summary=summary[:4000],
            uid=user_id,
        ),
    )

    created_tasks: list[str] = []
    for task in payload.get("suggested_tasks") or []:
        tid = str(uuid.uuid4())
        pid_row = (
            await session.execute(
                text("SELECT id FROM projects WHERE organization_id = CAST(:oid AS uuid) LIMIT 1").bindparams(
                    oid=org_id
                ),
            )
        ).first()
        pid = str(pid_row[0]) if pid_row else None
        await session.execute(
            text(
                "INSERT INTO tasks (id, organization_id, project_id, title, status, source, created_by)"
                " VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, 'todo',"
                " 'whatsapp', CAST(:uid AS uuid))"
            ).bindparams(
                tid=tid,
                oid=org_id,
                pid=pid,
                title=task.get("title", "Action réunion")[:500],
                uid=user_id,
            ),
        )
        created_tasks.append(tid)

    brain = MemoryService(session)
    await brain.write_memory(
        org_id=org_id,
        type="episodic",
        entity_type="meeting",
        entity_id=mid,
        note=f"Réunion WhatsApp approuvée: {summary[:300]}",
        source_module="meetings",
        source_id=mid,
    )
    return f"meeting:{mid},tasks:{','.join(created_tasks)}"
