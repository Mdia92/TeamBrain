"""MCP tool protocol types (JSON Schema tool definitions + results)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class MCPToolDefinition:
    """MCP tools/list entry."""

    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class MCPToolResult:
    """MCP tools/call result."""

    success: bool
    content: Any
    error: str | None = None
    sources: list[str] = field(default_factory=list)
