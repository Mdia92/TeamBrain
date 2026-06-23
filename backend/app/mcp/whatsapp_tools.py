"""MCP tools for WhatsApp send/receive."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.delivery.whatsapp import whatsapp_client
from app.mcp.registry import MCPRegistry
from app.mcp.types import MCPToolDefinition, MCPToolResult


def register(registry: MCPRegistry) -> None:
    registry.register(
        MCPToolDefinition(
            name="whatsapp_send_reminder",
            description="Send a WhatsApp reminder to a team member by name.",
            input_schema={
                "type": "object",
                "properties": {
                    "recipient_name": {"type": "string"},
                    "message": {"type": "string"},
                },
                "required": ["recipient_name", "message"],
            },
        ),
        _send_reminder,
    )


async def _send_reminder(*, arguments: dict[str, Any], context: dict[str, Any]) -> MCPToolResult:
    session = context["session"]
    org_id = context["org_id"]
    name = arguments["recipient_name"]
    message = arguments["message"]
    row = (
        await session.execute(
            text(
                "SELECT u.id, u.email, u.full_name FROM users u"
                " JOIN org_memberships om ON om.user_id = u.id"
                " WHERE om.organization_id = CAST(:oid AS uuid) AND om.is_active = true"
                " AND u.is_active = true AND u.full_name ILIKE :name LIMIT 1"
            ).bindparams(oid=org_id, name=f"%{name}%"),
        )
    ).mappings().first()
    if not row:
        return MCPToolResult(success=False, content=None, error=f"Utilisateur « {name} » introuvable")
    sent = whatsapp_client.send_message(row["email"] or row["full_name"], message)
    src = f"whatsapp:user:{row['id']}"
    return MCPToolResult(
        success=sent.get("status") != "not_configured",
        content={"user_id": str(row["id"]), "full_name": row["full_name"], "sent": sent},
        sources=[src],
        error=None if sent.get("status") != "not_configured" else "Twilio non configuré",
    )
