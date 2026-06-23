"""MCP tools for field reports (unified documents)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="field_reports_list_recent",
            description="Recent field reports for the organization.",
            input_schema={
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 10}},
            },
        ),
        _list_recent,
    )
    registry.register(
        MCPToolDefinition(
            name="field_reports_gaps_by_agent",
            description="Field agents who have not submitted a report recently.",
            input_schema={
                "type": "object",
                "properties": {"days": {"type": "integer", "default": 7}},
            },
        ),
        _gaps_by_agent,
    )


async def _list_recent(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    limit = arguments.get("limit", 10)
    rows = (
        await session.execute(
            text(
                "SELECT d.id, d.mission_date::text, d.location_name, d.doc_type AS report_type,"
                " u.full_name AS agent_name"
                " FROM documents d JOIN users u ON u.id = d.submitted_by"
                " WHERE d.organization_id = CAST(:oid AS uuid) AND d.doc_type = 'field_report'"
                " ORDER BY d.mission_date DESC NULLS LAST LIMIT :lim"
            ).bindparams(oid=org_id, lim=limit),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"document:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"reports": items}, sources=sources)


async def _gaps_by_agent(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    days = arguments.get("days", 7)
    rows = (
        await session.execute(
            text(
                "SELECT u.id, u.full_name, MAX(d.mission_date)::text AS last_report"
                " FROM users u"
                " JOIN org_memberships om ON om.user_id = u.id AND om.organization_id = CAST(:oid AS uuid)"
                " LEFT JOIN documents d ON d.submitted_by = u.id"
                " AND d.organization_id = CAST(:oid AS uuid) AND d.doc_type = 'field_report'"
                " WHERE om.is_active = true AND u.role = 'field_agent'"
                " GROUP BY u.id, u.full_name"
                " HAVING MAX(d.mission_date) IS NULL"
                " OR MAX(d.mission_date) < CURRENT_DATE - CAST(:days AS integer) * INTERVAL '1 day'"
            ).bindparams(oid=org_id, days=days),
        )
    ).mappings().all()
    items = [dict(r) for r in rows]
    sources = [f"user:{r['id']}" for r in items[:5]]
    return MCPToolResult(success=True, content={"agents_without_recent_report": items}, sources=sources)
