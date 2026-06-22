"""MCP tools for document search and summarize."""

from __future__ import annotations

from typing import Any

from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult
from app.services.document_search import search_documents_semantic


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="documents_search",
            description="Semantic document search (pgvector + ILIKE fallback).",
            input_schema={
                "type": "object",
                "properties": {"query": {"type": "string"}, "limit": {"type": "integer"}},
                "required": ["query"],
            },
        ),
        _search,
    )


async def _search(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    hits = await search_documents_semantic(
        session, org_id, arguments["query"], limit=arguments.get("limit", 10)
    )
    sources = [f"document:{h['id']} — {h.get('title', '')[:60]}" for h in hits]
    return MCPToolResult(success=True, content={"items": hits}, sources=sources)
