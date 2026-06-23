"""MCP tools for projects and tasks."""

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
            name="tasks_create",
            description="Create a task in the first matching project.",
            input_schema={
                "type": "object",
                "properties": {"title": {"type": "string"}, "project_id": {"type": "string"}},
                "required": ["title"],
            },
        ),
        _create_task,
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
    sources = [f"project:{data['id']}"]
    return MCPToolResult(success=True, content=data, sources=sources)


async def _create_task(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    user_id = context.get("user_id")
    if not user_id:
        return MCPToolResult(success=False, content=None, error="Utilisateur requis")
    pid = arguments.get("project_id")
    if not pid:
        proj = (
            await session.execute(
                text(
                    "SELECT id FROM projects WHERE organization_id = CAST(:oid AS uuid) LIMIT 1"
                ).bindparams(oid=org_id),
            )
        ).first()
        if not proj:
            return MCPToolResult(success=False, content=None, error="Aucun projet disponible")
        pid = str(proj[0])
    tid = str(uuid.uuid4())
    title = arguments["title"][:500]
    await session.execute(
        text(
            "INSERT INTO tasks (id, organization_id, project_id, title, status, source, created_by)"
            " VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title,"
            " 'todo', 'ai_suggestion', CAST(:uid AS uuid))"
        ).bindparams(tid=tid, oid=org_id, pid=pid, title=title, uid=user_id),
    )
    await session.commit()
    return MCPToolResult(success=True, content={"task_id": tid}, sources=[f"task:{tid}"])
