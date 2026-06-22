"""MCP client — dispatches tools/call to registered servers."""

from __future__ import annotations

from typing import Any

from app.mcp.registry import get_mcp_registry
from app.mcp.types import MCPToolResult


class MCPClient:
    """Protocol-compatible tool caller (MCP tools/list + tools/call semantics)."""

    def __init__(self) -> None:
        self._registry = get_mcp_registry()

    def list_tools(self):
        return self._registry.list_tools()

    async def call_tool(
        self,
        name: str,
        arguments: dict[str, Any],
        *,
        session,
        org_id: str,
        user_id: str | None = None,
    ) -> MCPToolResult:
        context = {"session": session, "org_id": org_id, "user_id": user_id}
        return await self._registry.call_tool(name, arguments, context)
