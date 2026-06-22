"""MCP tools for calendar CRUD."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import text

from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="calendar_list_events",
            description="List calendar events for the organization.",
            input_schema={"type": "object", "properties": {}},
        ),
        _list_events,
    )
    registry.register(
        MCPToolDefinition(
            name="calendar_create_event",
            description="Create a calendar event.",
            input_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "start_datetime": {"type": "string"},
                    "end_datetime": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["title", "start_datetime", "end_datetime"],
            },
        ),
        _create_event,
    )


async def _list_events(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    rows = (
        await session.execute(
            text(
                "SELECT id, title, start_datetime, end_datetime FROM events"
                " WHERE organization_id = CAST(:oid AS uuid) ORDER BY start_datetime LIMIT 20"
            ).bindparams(oid=org_id),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"calendar:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"items": items}, sources=sources)


async def _create_event(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    user_id = context["user_id"]
    eid = str(uuid.uuid4())
    await session.execute(
        text(
            "INSERT INTO events (id, organization_id, title, start_datetime, end_datetime,"
            " description, created_by) VALUES (CAST(:eid AS uuid), CAST(:oid AS uuid), :title,"
            " CAST(:start AS timestamptz), CAST(:end AS timestamptz), :desc, CAST(:uid AS uuid))"
        ).bindparams(
            eid=eid,
            oid=org_id,
            title=arguments["title"],
            start=arguments["start_datetime"],
            end=arguments["end_datetime"],
            desc=arguments.get("description", ""),
            uid=user_id,
        ),
    )
    await session.commit()
    return MCPToolResult(success=True, content={"event_id": eid}, sources=[f"calendar:{eid}"])
