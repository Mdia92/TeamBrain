"""Projects API."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.pagination import decode_cursor, encode_cursor

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectIn(BaseModel):
    name: str = Field(min_length=1)
    client_name: str | None = None
    description: str | None = None
    status: str = "active"
    start_date: date | None = None
    end_date: date | None = None
    budget_allocated: float | None = None
    project_type: str | None = None


@router.get("")
async def list_projects(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
) -> dict:
    params: dict = {"oid": str(user["organization_id"]), "lim": limit + 1}
    cursor_clause = ""
    if cursor:
        c = decode_cursor(cursor)
        cursor_clause = " AND (created_at, id) < (CAST(:c_at AS timestamptz), CAST(:c_id AS uuid))"
        params["c_at"] = c["created_at"]
        params["c_id"] = c["id"]
    rows = (
        await session.execute(
            text(
                "SELECT id, name, client_name, description, status, start_date, end_date,"
                " budget_allocated, budget_spent, project_type, created_at"
                " FROM projects WHERE organization_id = CAST(:oid AS uuid)"
                f"{cursor_clause} ORDER BY created_at DESC, id DESC LIMIT :lim"
            ).bindparams(**params),
        )
    ).mappings().all()
    items = [dict(r) for r in rows[:limit]]
    next_cursor = None
    if len(rows) > limit and items:
        last = items[-1]
        next_cursor = encode_cursor({"created_at": str(last["created_at"]), "id": str(last["id"])})
    return {"items": items, "next_cursor": next_cursor, "has_more": len(rows) > limit}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectIn,
    user: dict = Depends(require_role("owner", "admin", "manager")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    pid = uuid.uuid4()
    oid = str(user["organization_id"])
    await session.execute(
        text(
            "INSERT INTO projects (id, organization_id, name, client_name, description, status,"
            " start_date, end_date, budget_allocated, project_type, created_by)"
            " VALUES (CAST(:pid AS uuid), CAST(:oid AS uuid), :name, :client, :desc, :status,"
            " :start, :end, :budget, :ptype, CAST(:uid AS uuid))"
        ).bindparams(
            pid=str(pid),
            oid=oid,
            name=body.name,
            client=body.client_name,
            desc=body.description,
            status=body.status,
            start=body.start_date,
            end=body.end_date,
            budget=body.budget_allocated,
            ptype=body.project_type,
            uid=str(user["id"]),
        ),
    )
    await session.execute(
        text(
            "INSERT INTO channels (id, organization_id, name, project_id, created_by)"
            " VALUES (gen_random_uuid(), CAST(:oid AS uuid), :name, CAST(:pid AS uuid), CAST(:uid AS uuid))"
        ).bindparams(oid=oid, name=body.name, pid=str(pid), uid=str(user["id"])),
    )
    await session.execute(
        text(
            "INSERT INTO project_members (id, project_id, user_id, role_in_project)"
            " VALUES (gen_random_uuid(), CAST(:pid AS uuid), CAST(:uid AS uuid), 'lead')"
        ).bindparams(pid=str(pid), uid=str(user["id"])),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="project",
        entity_id=str(pid),
        note=f"Projet créé: {body.name}",
        source_module="projects",
        source_id=str(pid),
    )
    await session.commit()
    return {"id": str(pid), "name": body.name}


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    row = (
        (
            await session.execute(
                text(
                    "SELECT * FROM projects WHERE id = CAST(:pid AS uuid)"
                    " AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(pid=project_id, oid=str(user["organization_id"])),
            )
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projet introuvable")
    return dict(row)


@router.get("/{project_id}/timeline")
async def get_project_timeline(
    project_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    org_id = str(user["organization_id"])
    project = (
        await session.execute(
            text(
                "SELECT id, name, start_date, end_date, status"
                " FROM projects WHERE id = CAST(:pid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(pid=project_id, oid=org_id),
        )
    ).mappings().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projet introuvable")

    tasks = [
        dict(r)
        for r in (
            await session.execute(
                text(
                    "SELECT t.id, t.title, t.status, t.priority,"
                    " COALESCE(t.start_date, t.created_at::date) AS start_date,"
                    " COALESCE(t.due_date, COALESCE(t.start_date, t.created_at::date)) AS due_date,"
                    " t.assignee_id, u.full_name AS assignee_name, t.created_at"
                    " FROM tasks t"
                    " LEFT JOIN users u ON u.id = t.assignee_id"
                    " WHERE t.project_id = CAST(:pid AS uuid)"
                    " AND t.organization_id = CAST(:oid AS uuid)"
                    " ORDER BY start_date, t.title"
                ).bindparams(pid=project_id, oid=org_id),
            )
        ).mappings().all()
    ]

    dependencies: list[dict] = []
    deps = (
        await session.execute(
            text(
                "SELECT td.task_id::text, td.depends_on_task_id::text"
                " FROM task_dependencies td"
                " JOIN tasks t ON t.id = td.task_id"
                " WHERE td.organization_id = CAST(:oid AS uuid)"
                " AND t.project_id = CAST(:pid AS uuid)"
            ).bindparams(oid=org_id, pid=project_id),
        )
    ).mappings().all()
    dependencies = [dict(d) for d in deps]

    for t in tasks:
        t["id"] = str(t["id"])
        if t.get("start_date"):
            t["start_date"] = str(t["start_date"])
        if t.get("due_date"):
            t["due_date"] = str(t["due_date"])
        if t.get("created_at"):
            t["created_at"] = str(t["created_at"])
        if t.get("assignee_id"):
            t["assignee_id"] = str(t["assignee_id"])

    return {
        "project": {
            "id": str(project["id"]),
            "name": project["name"],
            "start_date": str(project["start_date"]) if project.get("start_date") else None,
            "end_date": str(project["end_date"]) if project.get("end_date") else None,
            "status": project["status"],
        },
        "tasks": tasks,
        "dependencies": dependencies,
    }


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectIn,
    user: dict = Depends(require_role("owner", "admin", "manager")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    await session.execute(
        text(
            "UPDATE projects SET name = :name, client_name = :client, description = :desc,"
            " status = :status, start_date = :start, end_date = :end, budget_allocated = :budget"
            " WHERE id = CAST(:pid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(
            pid=project_id,
            oid=str(user["organization_id"]),
            name=body.name,
            client=body.client_name,
            desc=body.description,
            status=body.status,
            start=body.start_date,
            end=body.end_date,
            budget=body.budget_allocated,
        ),
    )
    await session.commit()
    return {"id": project_id, "status": "updated"}


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    user: dict = Depends(require_role("owner", "admin", "manager")),
    session: AsyncSession = Depends(get_db),
) -> None:
    org_id = str(user["organization_id"])
    result = await session.execute(
        text(
            "DELETE FROM projects WHERE id = CAST(:pid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            " RETURNING id"
        ).bindparams(pid=project_id, oid=org_id),
    )
    if not result.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projet introuvable")
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=org_id,
        type="episodic",
        entity_type="project",
        entity_id=project_id,
        note=f"Projet supprimé: {project_id}",
        source_module="projects",
        source_id=project_id,
    )
    await session.commit()
