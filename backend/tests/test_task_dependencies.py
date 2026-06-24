"""Task dependency helper tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.task_dependencies import dependency_would_cycle


@pytest.mark.asyncio
async def test_dependency_self_cycle():
    session = AsyncMock()
    assert await dependency_would_cycle(session, "org", "a", "a") is True


@pytest.mark.asyncio
async def test_dependency_direct_cycle():
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = ["task-a"]
    session.execute = AsyncMock(return_value=result)
    assert await dependency_would_cycle(session, "org", "task-a", "task-b") is True


@pytest.mark.asyncio
async def test_dependency_no_cycle():
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    session.execute = AsyncMock(return_value=result)
    assert await dependency_would_cycle(session, "org", "task-a", "task-b") is False
