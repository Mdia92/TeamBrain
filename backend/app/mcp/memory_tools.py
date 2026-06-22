"""MCP tools wrapping MemoryService."""

from __future__ import annotations

from typing import Any

from app.agents.memory_service import MemoryService
from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="memory_search",
            description="Semantic search in organizational memory (pgvector).",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["query"],
            },
        ),
        _search,
    )
    registry.register(
        MCPToolDefinition(
            name="memory_write",
            description="Write an episodic or commitment memory entry.",
            input_schema={
                "type": "object",
                "properties": {
                    "note": {"type": "string"},
                    "type": {"type": "string", "default": "episodic"},
                    "entity_type": {"type": "string"},
                    "entity_id": {"type": "string"},
                    "source_module": {"type": "string"},
                    "source_id": {"type": "string"},
                },
                "required": ["note", "entity_type", "source_module"],
            },
        ),
        _write,
    )
    registry.register(
        MCPToolDefinition(
            name="memory_accountability",
            description="Who owes what — open tasks and commitments.",
            input_schema={"type": "object", "properties": {}},
        ),
        _accountability,
    )


async def _search(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    brain = MemoryService(session)
    hits = await brain.search_memory(org_id, arguments["query"], limit=arguments.get("limit", 10))
    items = [
        {
            "id": h.id,
            "type": h.type,
            "note": h.note,
            "source_module": h.source_module,
            "source_id": h.source_id,
            "similarity_score": h.similarity_score,
        }
        for h in hits
    ]
    sources = [f"{h.source_module}:{h.source_id} — {h.note[:80]}" for h in hits if h.source_module]
    return MCPToolResult(success=True, content={"items": items}, sources=sources)


async def _write(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    brain = MemoryService(session)
    mid = await brain.write_memory(
        org_id=org_id,
        type=arguments.get("type", "episodic"),
        entity_type=arguments["entity_type"],
        entity_id=arguments.get("entity_id"),
        note=arguments["note"],
        source_module=arguments["source_module"],
        source_id=arguments.get("source_id"),
    )
    return MCPToolResult(success=True, content={"memory_id": mid}, sources=[f"memory:{mid}"])


async def _accountability(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    brain = MemoryService(session)
    people = await brain.get_who_owes_what(org_id)
    sources = [f"accountability:{p.get('user_id')}" for p in people[:5]]
    return MCPToolResult(success=True, content={"people": people}, sources=sources)
