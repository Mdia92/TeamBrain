"""Tasks API — Kanban and list views."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.events.worker import trigger_on_task_change
from app.pagination import decode_cursor, encode_cursor
from app.trial import require_write_access

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskIn(BaseModel):
    project_id: str
    title: str = Field(min_length=1)
    description: str | None = None
    assignee_id: str | None = None
    due_date: date | None = None
    priority: str = "medium"
    status: str = "todo"


class TaskStatusIn(BaseModel):
    status: str


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
        "SELECT t.id, t.project_id, t.title, t.description, t.assignee_id, t.due_date,"
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
    await session.execute(
        text(
            "INSERT INTO tasks (id, organization_id, project_id, title, description,"
            " assignee_id, due_date, priority, status, source, created_by)"
            " VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, :desc,"
            " CAST(:aid AS uuid), :due, :priority, :status, 'manual', CAST(:uid AS uuid))"
        ).bindparams(
            tid=str(tid),
            oid=str(user["organization_id"]),
            pid=body.project_id,
            title=body.title,
            desc=body.description,
            aid=body.assignee_id,
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
    return {"id": str(tid)}


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    body: TaskStatusIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(
        text(
            "UPDATE tasks SET status = :status WHERE id = CAST(:tid AS uuid)"
            " AND organization_id = CAST(:oid AS uuid)"
            " RETURNING id, title, assignee_id, organization_id"
        ).bindparams(tid=task_id, oid=str(user["organization_id"]), status=body.status),
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
    await trigger_on_task_change(session, str(user["organization_id"]))
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
            " due_date = :due, priority = :priority, status = :status"
            " WHERE id = CAST(:tid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(
            tid=task_id,
            oid=str(user["organization_id"]),
            title=body.title,
            desc=body.description,
            aid=body.assignee_id,
            due=body.due_date,
            priority=body.priority,
            status=body.status,
        ),
    )
    await session.commit()
    return {"id": task_id, "status": "updated"}
