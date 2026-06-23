"""MCP tools for task management."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import text

from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="tasks_create",
            description="Create a task in a project.",
            input_schema={
                "type": "object",
                "properties": {"title": {"type": "string"}, "project_id": {"type": "string"}},
                "required": ["title"],
            },
        ),
        _create_task,
    )
    registry.register(
        MCPToolDefinition(
            name="tasks_update_status",
            description="Update task status (todo, in_progress, done).",
            input_schema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string"},
                    "status": {"type": "string"},
                },
                "required": ["task_id", "status"],
            },
        ),
        _update_status,
    )
    registry.register(
        MCPToolDefinition(
            name="tasks_list_by_assignee",
            description="List open tasks for a team member by name.",
            input_schema={
                "type": "object",
                "properties": {"assignee_name": {"type": "string"}, "limit": {"type": "integer"}},
                "required": ["assignee_name"],
            },
        ),
        _list_by_assignee,
    )
    registry.register(
        MCPToolDefinition(
            name="tasks_list_overdue",
            description="List overdue tasks for the organization.",
            input_schema={
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 20}},
            },
        ),
        _list_overdue,
    )


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
                text("SELECT id FROM projects WHERE organization_id = CAST(:oid AS uuid) LIMIT 1").bindparams(
                    oid=org_id
                ),
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
    return MCPToolResult(success=True, content={"task_id": tid, "title": title}, sources=[f"task:{tid}"])


async def _update_status(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    tid = arguments["task_id"]
    status = arguments["status"]
    row = (
        await session.execute(
            text(
                "UPDATE tasks SET status = :st WHERE id = CAST(:tid AS uuid)"
                " AND organization_id = CAST(:oid AS uuid) RETURNING id, title"
            ).bindparams(st=status, tid=tid, oid=org_id),
        )
    ).mappings().first()
    if not row:
        return MCPToolResult(success=False, content=None, error="Tâche introuvable")
    await session.commit()
    return MCPToolResult(success=True, content=dict(row), sources=[f"task:{tid}"])


async def _list_by_assignee(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    name = arguments["assignee_name"]
    limit = arguments.get("limit", 20)
    rows = (
        await session.execute(
            text(
                "SELECT t.id, t.title, t.status, t.due_date::text, u.full_name"
                " FROM tasks t JOIN users u ON u.id = t.assignee_id"
                " WHERE t.organization_id = CAST(:oid AS uuid) AND t.status != 'done'"
                " AND u.full_name ILIKE :name ORDER BY t.due_date NULLS LAST LIMIT :lim"
            ).bindparams(oid=org_id, name=f"%{name}%", lim=limit),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"task:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"tasks": items}, sources=sources)


async def _list_overdue(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    limit = arguments.get("limit", 20)
    rows = (
        await session.execute(
            text(
                "SELECT t.id, t.title, t.due_date::text, u.full_name AS assignee"
                " FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id"
                " WHERE t.organization_id = CAST(:oid AS uuid) AND t.status != 'done'"
                " AND t.due_date < CURRENT_DATE ORDER BY t.due_date LIMIT :lim"
            ).bindparams(oid=org_id, lim=limit),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"task:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"tasks": items}, sources=sources)
