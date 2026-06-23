"""Central MCP tool registry."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from app.mcp.types import MCPToolDefinition, MCPToolResult

ToolHandler = Callable[..., Awaitable[MCPToolResult]]


class MCPRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, MCPToolDefinition] = {}
        self._handlers: dict[str, ToolHandler] = {}

    def register(
        self,
        definition: MCPToolDefinition,
        handler: ToolHandler,
    ) -> None:
        self._tools[definition.name] = definition
        self._handlers[definition.name] = handler

    def list_tools(self) -> list[MCPToolDefinition]:
        return list(self._tools.values())

    async def call_tool(self, name: str, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
        handler = self._handlers.get(name)
        if not handler:
            return MCPToolResult(success=False, content=None, error=f"Unknown tool: {name}")
        try:
            return await handler(arguments=arguments, context=context)
        except Exception as exc:
            return MCPToolResult(success=False, content=None, error=str(exc))


_registry: MCPRegistry | None = None


def get_mcp_registry() -> MCPRegistry:
    global _registry
    if _registry is None:
        _registry = MCPRegistry()
        from app.mcp import (
            calendar_tools,
            document_tools,
            field_reports_tools,
            meetings_tools,
            memory_tools,
            projects_tools,
            tasks_tools,
            whatsapp_tools,
        )

        memory_tools.register(_registry)
        calendar_tools.register(_registry)
        document_tools.register(_registry)
        meetings_tools.register(_registry)
        projects_tools.register(_registry)
        tasks_tools.register(_registry)
        field_reports_tools.register(_registry)
        whatsapp_tools.register(_registry)
    return _registry
