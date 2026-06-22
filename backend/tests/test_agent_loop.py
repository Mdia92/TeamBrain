"""Agent loop and hallucination guard tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agents.agent_loop import confidence_label, run_agent
from app.agents.llm_client import llm_configured


def test_confidence_label_bands():
    assert confidence_label(0.8) == "Haute"
    assert confidence_label(0.65) == "Moyenne"
    assert confidence_label(0.3) == "Faible"


def test_llm_configured_without_keys(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")
    monkeypatch.setattr(settings, "mistral_api_key", "")
    assert llm_configured() is False


@pytest.mark.asyncio
async def test_agent_no_api_keys(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")
    monkeypatch.setattr(settings, "mistral_api_key", "")

    session = AsyncMock()
    result = await run_agent(session, "11111111-1111-1111-1111-111111111111", "Test?")
    assert result.api_configured is False
    assert "Configurez une clé API" in result.answer


@pytest.mark.asyncio
async def test_agent_low_context_response(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "groq_api_key", "test-key")

    session = AsyncMock()
    project_result = MagicMock()
    project_result.mappings.return_value.all.return_value = []

    async def execute_side_effect(*args, **kwargs):
        return project_result

    session.execute = AsyncMock(side_effect=execute_side_effect)

    from app.mcp.client import MCPClient

    async def fake_call_tool(self, name, arguments, *, session, org_id, user_id=None):
        from app.mcp.types import MCPToolResult

        if name == "memory_search":
            return MCPToolResult(success=True, content={"items": []}, sources=[])
        return MCPToolResult(success=True, content={}, sources=[])

    monkeypatch.setattr(MCPClient, "call_tool", fake_call_tool)

    result = await run_agent(session, "11111111-1111-1111-1111-111111111111", "Quel projet?")
    assert "pas assez d'informations" in result.answer.lower()
    assert result.grounded is False
