"""Projects API."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db

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
async def list_projects(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT id, name, client_name, description, status, start_date, end_date,"
                " budget_allocated, budget_spent, project_type, created_at"
                " FROM projects WHERE organization_id = CAST(:oid AS uuid) ORDER BY created_at DESC"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectIn,
    user: dict = Depends(get_current_user),
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


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectIn,
    user: dict = Depends(get_current_user),
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
