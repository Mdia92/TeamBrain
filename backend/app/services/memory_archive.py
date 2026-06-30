"""Archive entity knowledge to Team Brain memory before operational delete."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.db.sql_compat import is_sqlite
from app.storage.s3 import get_storage
from app.storage.urls import storage_key_from_url

_TRUNC = 2000
_TRANSCRIPT = 4000


def _clip(text: str | None, limit: int = _TRUNC) -> str:
    if not text:
        return ""
    t = text.strip()
    return t if len(t) <= limit else f"{t[:limit]}…"


def _archive_header(entity_label: str, name: str, entity_id: str) -> str:
    ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    return (
        f"[ARCHIVÉ — {entity_label} retiré de l'espace actif, essence conservée en mémoire]\n"
        f"Référence : {entity_id}\n"
        f"Nom : {name}\n"
        f"Archivé le : {ts}\n"
    )


async def archive_task(
    session: AsyncSession,
    *,
    org_id: str,
    task_id: str,
    context: str = "",
) -> str | None:
    if is_sqlite():
        row = (
            await session.execute(
                text(
                    "SELECT t.title, t.description, t.status, t.priority, t.due_date,"
                    " t.project_id, u.full_name AS assignee_name"
                    " FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id"
                    " WHERE t.id = :tid AND t.organization_id = :oid"
                ).bindparams(tid=task_id, oid=org_id),
            )
        ).mappings().first()
    else:
        row = (
            await session.execute(
                text(
                    "SELECT t.title, t.description, t.status, t.priority, t.due_date,"
                    " t.project_id, u.full_name AS assignee_name"
                    " FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id"
                    " WHERE t.id = CAST(:tid AS uuid) AND t.organization_id = CAST(:oid AS uuid)"
                ).bindparams(tid=task_id, oid=org_id),
            )
        ).mappings().first()
    if not row:
        return None

    note = _archive_header("tâche", row["title"], task_id)
    if context:
        note += f"Contexte : {context}\n"
    note += (
        f"Statut final : {row['status']}\n"
        f"Priorité : {row.get('priority') or 'medium'}\n"
    )
    if row.get("assignee_name"):
        note += f"Assigné à : {row['assignee_name']}\n"
    if row.get("due_date"):
        note += f"Échéance : {row['due_date']}\n"
    if row.get("description"):
        note += f"Description : {_clip(row['description'])}\n"

    brain = MemoryService(session)
    return await brain.write_memory(
        org_id=org_id,
        type="semantic",
        entity_type="task",
        entity_id=task_id,
        note=note,
        source_module="tasks",
        source_id=task_id,
    )


async def archive_project(
    session: AsyncSession,
    *,
    org_id: str,
    project_id: str,
    deleted_by: str | None = None,
) -> str | None:
    if is_sqlite():
        row = (
            await session.execute(
                text(
                    "SELECT name, client_name, description, status, start_date, end_date, project_type"
                    " FROM projects WHERE id = :pid AND organization_id = :oid"
                ).bindparams(pid=project_id, oid=org_id),
            )
        ).mappings().first()
        task_rows = (
            await session.execute(
                text(
                    "SELECT id, title, status FROM tasks WHERE project_id = :pid AND organization_id = :oid"
                ).bindparams(pid=project_id, oid=org_id),
            )
        ).mappings().all()
    else:
        row = (
            await session.execute(
                text(
                    "SELECT name, client_name, description, status, start_date, end_date, project_type"
                    " FROM projects WHERE id = CAST(:pid AS uuid)"
                    " AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(pid=project_id, oid=org_id),
            )
        ).mappings().first()
        task_rows = (
            await session.execute(
                text(
                    "SELECT id, title, status FROM tasks WHERE project_id = CAST(:pid AS uuid)"
                    " AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(pid=project_id, oid=org_id),
            )
        ).mappings().all()

    if not row:
        return None

    for t in task_rows:
        await archive_task(
            session,
            org_id=org_id,
            task_id=str(t["id"]),
            context=f"Archivée avec le projet « {row['name']} »",
        )

    note = _archive_header("projet", row["name"], project_id)
    if deleted_by:
        note += f"Supprimé par : {deleted_by}\n"
    if row.get("client_name"):
        note += f"Client : {row['client_name']}\n"
    note += f"Statut final : {row['status']}\n"
    if row.get("project_type"):
        note += f"Type : {row['project_type']}\n"
    if row.get("start_date") or row.get("end_date"):
        note += f"Période : {row.get('start_date') or '?'} → {row.get('end_date') or '?'}\n"
    if row.get("description"):
        note += f"Description : {_clip(row['description'])}\n"
    if task_rows:
        lines = [f"- {t['title']} ({t['status']})" for t in task_rows[:30]]
        note += f"Tâches du projet ({len(task_rows)}) :\n" + "\n".join(lines) + "\n"

    brain = MemoryService(session)
    return await brain.write_memory(
        org_id=org_id,
        type="semantic",
        entity_type="project",
        entity_id=project_id,
        note=note,
        source_module="projects",
        source_id=project_id,
    )


async def archive_meeting(
    session: AsyncSession,
    *,
    org_id: str,
    meeting_id: str,
    deleted_by: str | None = None,
) -> str | None:
    if is_sqlite():
        meeting = (
            await session.execute(
                text(
                    "SELECT title, date, ai_summary, transcript_text, processing_status, audio_url"
                    " FROM meetings WHERE id = :mid AND organization_id = :oid"
                ).bindparams(mid=meeting_id, oid=org_id),
            )
        ).mappings().first()
    else:
        meeting = (
            await session.execute(
                text(
                    "SELECT title, date, ai_summary, transcript_text, processing_status, audio_url"
                    " FROM meetings WHERE id = CAST(:mid AS uuid)"
                    " AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(mid=meeting_id, oid=org_id),
            )
        ).mappings().first()
    if not meeting:
        return None

    if is_sqlite():
        decisions = (
            await session.execute(
                text("SELECT decision_text FROM meeting_decisions WHERE meeting_id = :mid").bindparams(
                    mid=meeting_id,
                ),
            )
        ).scalars().all()
        actions = (
            await session.execute(
                text("SELECT description, status FROM meeting_action_items WHERE meeting_id = :mid").bindparams(
                    mid=meeting_id,
                ),
            )
        ).mappings().all()
        commitments = (
            await session.execute(
                text("SELECT commitment_text, deadline FROM meeting_commitments WHERE meeting_id = :mid").bindparams(
                    mid=meeting_id,
                ),
            )
        ).mappings().all()
    else:
        decisions = (
            await session.execute(
                text(
                    "SELECT decision_text FROM meeting_decisions WHERE meeting_id = CAST(:mid AS uuid)"
                ).bindparams(mid=meeting_id),
            )
        ).scalars().all()
        actions = (
            await session.execute(
                text(
                    "SELECT description, status FROM meeting_action_items"
                    " WHERE meeting_id = CAST(:mid AS uuid)"
                ).bindparams(mid=meeting_id),
            )
        ).mappings().all()
        commitments = (
            await session.execute(
                text(
                    "SELECT commitment_text, deadline FROM meeting_commitments"
                    " WHERE meeting_id = CAST(:mid AS uuid)"
                ).bindparams(mid=meeting_id),
            )
        ).mappings().all()

    note = _archive_header("réunion", meeting["title"], meeting_id)
    if deleted_by:
        note += f"Supprimé par : {deleted_by}\n"
    note += f"Date : {meeting.get('date')}\n"
    if meeting.get("ai_summary"):
        note += f"Résumé IA : {_clip(meeting['ai_summary'])}\n"
    if meeting.get("transcript_text"):
        note += f"Extrait transcription : {_clip(meeting['transcript_text'], _TRANSCRIPT)}\n"
    if decisions:
        note += "Décisions :\n" + "\n".join(f"- {d}" for d in decisions[:20]) + "\n"
    if actions:
        note += "Actions :\n" + "\n".join(
            f"- {a['description']} ({a['status']})" for a in actions[:20]
        ) + "\n"
    if commitments:
        note += "Engagements :\n" + "\n".join(
            f"- {c['commitment_text']}" + (f" (échéance {c['deadline']})" if c.get("deadline") else "")
            for c in commitments[:20]
        ) + "\n"

    brain = MemoryService(session)
    memory_id = await brain.write_memory(
        org_id=org_id,
        type="semantic",
        entity_type="meeting",
        entity_id=meeting_id,
        note=note,
        source_module="meetings",
        source_id=meeting_id,
    )

    if meeting.get("audio_url"):
        parsed = storage_key_from_url(meeting["audio_url"])
        if parsed:
            bucket, key = parsed
            if bucket != "local":
                await get_storage().delete(key)

    return memory_id


async def archive_document(
    session: AsyncSession,
    *,
    org_id: str,
    doc_id: str,
    deleted_by: str | None = None,
    delete_file: bool = True,
) -> str | None:
    if is_sqlite():
        row = (
            await session.execute(
                text(
                    "SELECT title, doc_type, ai_summary, ocr_text, mission_date,"
                    " location_name, file_url, content_type"
                    " FROM documents WHERE id = :did AND organization_id = :oid"
                ).bindparams(did=doc_id, oid=org_id),
            )
        ).mappings().first()
    else:
        row = (
            await session.execute(
                text(
                    "SELECT title, doc_type, ai_summary, ocr_text, mission_date,"
                    " location_name, file_url, content_type"
                    " FROM documents WHERE id = CAST(:did AS uuid)"
                    " AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(did=doc_id, oid=org_id),
            )
        ).mappings().first()
    if not row:
        return None

    note = _archive_header("document", row["title"], doc_id)
    if deleted_by:
        note += f"Supprimé par : {deleted_by}\n"
    note += f"Type : {row.get('doc_type') or 'document'}\n"
    if row.get("mission_date"):
        note += f"Date mission : {row['mission_date']}\n"
    if row.get("location_name"):
        note += f"Lieu : {row['location_name']}\n"
    if row.get("ai_summary"):
        note += f"Résumé IA : {_clip(row['ai_summary'])}\n"
    if row.get("ocr_text"):
        note += f"Contenu extrait : {_clip(row['ocr_text'], _TRANSCRIPT)}\n"

    brain = MemoryService(session)
    memory_id = await brain.write_memory(
        org_id=org_id,
        type="semantic",
        entity_type="document",
        entity_id=doc_id,
        note=note,
        source_module="documents",
        source_id=doc_id,
    )

    if delete_file and row.get("file_url"):
        parsed = storage_key_from_url(row["file_url"])
        if parsed:
            _bucket, key = parsed
            if _bucket != "local":
                await get_storage().delete(key)

    return memory_id
