"""Tasks API — list and task board views."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user, require_role
from app.automation import run_automation_event
from app.db.session import get_db
from app.events.worker import trigger_on_task_change
from app.pagination import decode_cursor, encode_cursor
from app.services.module_findings import ingest_task_event
from app.services.task_dependencies import dependency_would_cycle, unresolved_dependency_titles
from app.trial import require_write_access

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

MANAGER_ROLES = frozenset({"owner", "admin", "manager"})


class TaskIn(BaseModel):
    project_id: str | None = None
    title: str = Field(min_length=1)
    description: str | None = None
    assignee_id: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    priority: str = "medium"
    status: str = "todo"


class TaskStatusIn(BaseModel):
    status: str


class TaskDependencyIn(BaseModel):
    depends_on_task_id: str


class TaskDatesIn(BaseModel):
    start_date: date
    due_date: date


@router.get("")
async def list_tasks(
    project_id: str | None = None,
    status: str | None = None,
    assignee_id: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    query = (
        "SELECT t.id, t.project_id, t.title, t.description, t.assignee_id, t.start_date, t.due_date,"
        " t.priority, t.status, t.source, t.source_reference, t.created_at,"
        " u.full_name AS assignee_name"
        " FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id"
        " WHERE t.organization_id = CAST(:oid AS uuid)"
    )
    params: dict = {"oid": str(user["organization_id"]), "lim": limit + 1}
    if project_id:
        query += " AND t.project_id = CAST(:pid AS uuid)"
        params["pid"] = project_id
    if status:
        query += " AND t.status = :status"
        params["status"] = status
    if assignee_id:
        query += " AND t.assignee_id = CAST(:aid AS uuid)"
        params["aid"] = assignee_id
    if cursor:
        c = decode_cursor(cursor)
        query += " AND (COALESCE(t.due_date, '9999-12-31'), t.created_at, t.id) > (COALESCE(CAST(:c_due AS date), '9999-12-31'), CAST(:c_at AS timestamptz), CAST(:c_id AS uuid))"
        params["c_due"] = c.get("due_date")
        params["c_at"] = c["created_at"]
        params["c_id"] = c["id"]
    query += " ORDER BY t.due_date NULLS LAST, t.created_at DESC, t.id LIMIT :lim"

    rows = (await session.execute(text(query).bindparams(**params))).mappings().all()
    items = [dict(r) for r in rows[:limit]]
    next_cursor = None
    if len(rows) > limit and items:
        last = items[-1]
        next_cursor = encode_cursor({
            "due_date": str(last["due_date"]) if last.get("due_date") else None,
            "created_at": str(last["created_at"]),
            "id": str(last["id"]),
        })
    return {"items": items, "next_cursor": next_cursor, "has_more": len(rows) > limit}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    tid = uuid.uuid4()
    pid_sql = "CAST(:pid AS uuid)" if body.project_id else "NULL"
    aid_sql = "CAST(:aid AS uuid)" if body.assignee_id else "NULL"
    await session.execute(
        text(
            "INSERT INTO tasks (id, organization_id, project_id, title, description,"
            " assignee_id, start_date, due_date, priority, status, source, created_by)"
            f" VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), {pid_sql}, :title, :desc,"
            f" {aid_sql}, :start, :due, :priority, :status, 'manual', CAST(:uid AS uuid))"
        ).bindparams(
            tid=str(tid),
            oid=str(user["organization_id"]),
            pid=body.project_id,
            title=body.title,
            desc=body.description,
            aid=body.assignee_id,
            start=body.start_date,
            due=body.due_date,
            priority=body.priority,
            status=body.status,
            uid=str(user["id"]),
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=str(user["organization_id"]),
        type="episodic",
        entity_type="task",
        entity_id=str(tid),
        note=f"Tâche créée: {body.title}",
        source_module="tasks",
        source_id=str(tid),
    )
    await session.commit()
    await ingest_task_event(
        session,
        org_id=str(user["organization_id"]),
        task_id=str(tid),
        summary=f"Tâche créée: {body.title}",
    )
    await session.commit()
    await run_automation_event(
        session,
        org_id=str(user["organization_id"]),
        trigger_type="task_created",
        context={
            "task_id": str(tid),
            "title": body.title,
            "project_id": body.project_id,
            "assignee_id": body.assignee_id,
            "created_by": str(user["id"]),
        },
    )
    return {"id": str(tid)}


async def _get_task_org(session: AsyncSession, task_id: str, org_id: str) -> dict | None:
    row = (
        await session.execute(
            text(
                "SELECT id, project_id, title FROM tasks"
                " WHERE id = CAST(:tid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(tid=task_id, oid=org_id),
        )
    ).mappings().first()
    return dict(row) if row else None


@router.post("/{task_id}/dependencies", status_code=status.HTTP_201_CREATED)
async def add_task_dependency(
    task_id: str,
    body: TaskDependencyIn,
    user: dict = Depends(require_role("owner", "admin", "manager")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    org_id = str(user["organization_id"])
    task = await _get_task_org(session, task_id, org_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche introuvable")
    parent = await _get_task_org(session, body.depends_on_task_id, org_id)
    if not parent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche prérequis introuvable")
    if str(task["project_id"]) != str(parent["project_id"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Les tâches doivent appartenir au même projet")
    if await dependency_would_cycle(session, org_id, task_id, body.depends_on_task_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cette dépendance créerait un cycle")

    dep_id = uuid.uuid4()
    try:
        await session.execute(
            text(
                "INSERT INTO task_dependencies (id, organization_id, task_id, depends_on_task_id)"
                " VALUES (CAST(:id AS uuid), CAST(:oid AS uuid), CAST(:tid AS uuid), CAST(:dep AS uuid))"
            ).bindparams(
                id=str(dep_id),
                oid=org_id,
                tid=task_id,
                dep=body.depends_on_task_id,
            ),
        )
        await session.commit()
    except Exception as exc:
        await session.rollback()
        if "uq_task_dependency" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status.HTTP_409_CONFLICT, "Cette dépendance existe déjà") from exc
        raise
    return {"id": str(dep_id), "task_id": task_id, "depends_on_task_id": body.depends_on_task_id}


@router.delete("/{task_id}/dependencies/{depends_on_task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_task_dependency(
    task_id: str,
    depends_on_task_id: str,
    user: dict = Depends(require_role("owner", "admin", "manager")),
    session: AsyncSession = Depends(get_db),
) -> None:
    result = await session.execute(
        text(
            "DELETE FROM task_dependencies"
            " WHERE task_id = CAST(:tid AS uuid)"
            " AND depends_on_task_id = CAST(:dep AS uuid)"
            " AND organization_id = CAST(:oid AS uuid)"
            " RETURNING id"
        ).bindparams(tid=task_id, dep=depends_on_task_id, oid=str(user["organization_id"])),
    )
    if not result.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dépendance introuvable")
    await session.commit()


@router.patch("/{task_id}/dates")
async def update_task_dates(
    task_id: str,
    body: TaskDatesIn,
    user: dict = Depends(require_role("owner", "admin", "manager")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.due_date < body.start_date:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La date de fin doit être après la date de début")
    result = await session.execute(
        text(
            "UPDATE tasks SET start_date = :start, due_date = :due, updated_at = now()"
            " WHERE id = CAST(:tid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            " RETURNING id"
        ).bindparams(
            tid=task_id,
            oid=str(user["organization_id"]),
            start=body.start_date,
            due=body.due_date,
        ),
    )
    if not result.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche introuvable")
    await session.commit()
    return {"id": task_id, "start_date": str(body.start_date), "due_date": str(body.due_date)}


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    body: TaskStatusIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    org_id = str(user["organization_id"])
    role = user.get("role")

    existing = (
        await session.execute(
            text(
                "SELECT id, title, assignee_id, organization_id, status"
                " FROM tasks WHERE id = CAST(:tid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(tid=task_id, oid=org_id),
        )
    ).mappings().first()
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche introuvable")

    if role not in MANAGER_ROLES:
        assignee_id = existing.get("assignee_id")
        if not assignee_id or str(assignee_id) != str(user["id"]):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Vous ne pouvez modifier que vos tâches assignées",
            )
        if body.status != "done":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Les membres peuvent uniquement marquer leurs tâches comme terminées",
            )

    if body.status == "done":
        blocked = await unresolved_dependency_titles(session, org_id, task_id)
        if blocked:
            titles = "», « ".join(blocked)
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Impossible de terminer la tâche : des dépendances ne sont pas encore terminées (« {titles} »).",
            )

    result = await session.execute(
        text(
            "UPDATE tasks SET status = :status, updated_at = now() WHERE id = CAST(:tid AS uuid)"
            " AND organization_id = CAST(:oid AS uuid)"
            " RETURNING id, title, assignee_id, organization_id"
        ).bindparams(tid=task_id, oid=org_id, status=body.status),
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche introuvable")

    if body.status == "done":
        assignee = None
        if row["assignee_id"]:
            assignee = (
                await session.execute(
                    text("SELECT full_name FROM users WHERE id = CAST(:uid AS uuid)").bindparams(
                        uid=str(row["assignee_id"])
                    ),
                )
            ).scalar()
        brain = MemoryService(session)
        await brain.write_memory(
            org_id=str(row["organization_id"]),
            type="episodic",
            entity_type="task",
            entity_id=task_id,
            note=f"Task completed: {row['title']} (assigned to: {assignee or 'unassigned'})",
            source_module="tasks",
            source_id=task_id,
        )

    await session.commit()
    await ingest_task_event(
        session,
        org_id=org_id,
        task_id=task_id,
        summary=f"Statut tâche → {body.status}: {row['title']}",
    )
    await session.commit()
    await trigger_on_task_change(session, org_id)
    return {"id": task_id, "status": body.status}


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    await session.execute(
        text(
            "UPDATE tasks SET title = :title, description = :desc, assignee_id = CAST(:aid AS uuid),"
            " start_date = :start, due_date = :due, priority = :priority, status = :status, updated_at = now()"
            " WHERE id = CAST(:tid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(
            tid=task_id,
            oid=str(user["organization_id"]),
            title=body.title,
            desc=body.description,
            aid=body.assignee_id,
            start=body.start_date,
            due=body.due_date,
            priority=body.priority,
            status=body.status,
        ),
    )
    await session.commit()
    return {"id": task_id, "status": "updated"}


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    user: dict = Depends(require_role("owner", "admin", "manager")),
    session: AsyncSession = Depends(get_db),
) -> None:
    org_id = str(user["organization_id"])
    result = await session.execute(
        text(
            "DELETE FROM tasks WHERE id = CAST(:tid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            " RETURNING id"
        ).bindparams(tid=task_id, oid=org_id),
    )
    if not result.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche introuvable")
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=org_id,
        type="episodic",
        entity_type="task",
        entity_id=task_id,
        note=f"Tâche supprimée: {task_id}",
        source_module="tasks",
        source_id=task_id,
    )
    await session.commit()
