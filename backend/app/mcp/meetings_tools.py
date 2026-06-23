"""MCP tools for meeting intelligence."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="meetings_recent_decisions",
            description="Recent meeting decisions for the organization.",
            input_schema={
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 10}},
            },
        ),
        _recent_decisions,
    )
    registry.register(
        MCPToolDefinition(
            name="meetings_list_recent",
            description="Recent meetings with summaries.",
            input_schema={
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 5}},
            },
        ),
        _list_recent,
    )
    registry.register(
        MCPToolDefinition(
            name="meetings_get_commitments",
            description="Recent meeting commitments for the organization.",
            input_schema={
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 10}},
            },
        ),
        _get_commitments,
    )


async def _recent_decisions(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    limit = arguments.get("limit", 10)
    rows = (
        await session.execute(
            text(
                "SELECT md.id, md.decision_text, m.title AS meeting_title, m.date::text"
                " FROM meeting_decisions md"
                " JOIN meetings m ON m.id = md.meeting_id"
                " WHERE m.organization_id = CAST(:oid AS uuid)"
                " ORDER BY m.date DESC LIMIT :lim"
            ).bindparams(oid=org_id, lim=limit),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"meeting_decision:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"decisions": items}, sources=sources)


async def _list_recent(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    limit = arguments.get("limit", 5)
    rows = (
        await session.execute(
            text(
                "SELECT id, title, date::text, ai_summary FROM meetings"
                " WHERE organization_id = CAST(:oid AS uuid)"
                " ORDER BY date DESC LIMIT :lim"
            ).bindparams(oid=org_id, lim=limit),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"meeting:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"meetings": items}, sources=sources)


async def _get_commitments(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    limit = arguments.get("limit", 10)
    rows = (
        await session.execute(
            text(
                "SELECT mc.id, mc.commitment_text, mc.deadline::text, m.title AS meeting_title"
                " FROM meeting_commitments mc"
                " JOIN meetings m ON m.id = mc.meeting_id"
                " WHERE m.organization_id = CAST(:oid AS uuid)"
                " ORDER BY m.date DESC LIMIT :lim"
            ).bindparams(oid=org_id, lim=limit),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"meeting_commitment:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"commitments": items}, sources=sources)
