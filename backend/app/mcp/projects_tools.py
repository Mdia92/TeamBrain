"""MCP tools for projects."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import text

from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="projects_list",
            description="List active projects with task counts.",
            input_schema={"type": "object", "properties": {}},
        ),
        _list_projects,
    )
    registry.register(
        MCPToolDefinition(
            name="projects_status",
            description="Status of a project by name (partial match).",
            input_schema={
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        ),
        _project_status,
    )
    registry.register(
        MCPToolDefinition(
            name="projects_create",
            description="Create a new project.",
            input_schema={
                "type": "object",
                "properties": {"name": {"type": "string"}, "description": {"type": "string"}},
                "required": ["name"],
            },
        ),
        _create_project,
    )
    registry.register(
        MCPToolDefinition(
            name="projects_update",
            description="Update project status or description.",
            input_schema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "status": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["project_id"],
            },
        ),
        _update_project,
    )


async def _list_projects(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    rows = (
        await session.execute(
            text(
                "SELECT p.id, p.name, p.status,"
                " (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_tasks"
                " FROM projects p WHERE p.organization_id = CAST(:oid AS uuid)"
                " ORDER BY p.created_at DESC LIMIT 20"
            ).bindparams(oid=org_id),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"project:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"projects": items}, sources=sources)


async def _project_status(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    name = arguments["name"]
    row = (
        await session.execute(
            text(
                "SELECT p.id, p.name, p.status, p.description,"
                " (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,"
                " (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks"
                " FROM projects p"
                " WHERE p.organization_id = CAST(:oid AS uuid) AND p.name ILIKE :name"
                " LIMIT 1"
            ).bindparams(oid=org_id, name=f"%{name}%"),
        )
    ).mappings().first()
    if not row:
        return MCPToolResult(success=False, content=None, error=f"Projet « {name} » introuvable")
    data = dict(row)
    return MCPToolResult(success=True, content=data, sources=[f"project:{data['id']}"])


async def _create_project(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    user_id = context.get("user_id")
    if not user_id:
        return MCPToolResult(success=False, content=None, error="Utilisateur requis")
    pid = str(uuid.uuid4())
    name = arguments["name"][:200]
    desc = arguments.get("description")
    await session.execute(
        text(
            "INSERT INTO projects (id, organization_id, name, description, status, created_by)"
            " VALUES (CAST(:pid AS uuid), CAST(:oid AS uuid), :name, :desc, 'active', CAST(:uid AS uuid))"
        ).bindparams(pid=pid, oid=org_id, name=name, desc=desc, uid=user_id),
    )
    await session.commit()
    return MCPToolResult(success=True, content={"project_id": pid, "name": name}, sources=[f"project:{pid}"])


async def _update_project(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    pid = arguments["project_id"]
    sets = []
    params: dict[str, Any] = {"pid": pid, "oid": org_id}
    if arguments.get("status"):
        sets.append("status = :status")
        params["status"] = arguments["status"]
    if arguments.get("description") is not None:
        sets.append("description = :desc")
        params["desc"] = arguments["description"]
    if not sets:
        return MCPToolResult(success=False, content=None, error="Aucun champ à mettre à jour")
    row = (
        await session.execute(
            text(
                f"UPDATE projects SET {', '.join(sets)} WHERE id = CAST(:pid AS uuid)"
                f" AND organization_id = CAST(:oid AS uuid) RETURNING id, name, status"
            ).bindparams(**params),
        )
    ).mappings().first()
    if not row:
        return MCPToolResult(success=False, content=None, error="Projet introuvable")
    await session.commit()
    return MCPToolResult(success=True, content=dict(row), sources=[f"project:{pid}"])
