"""MemoryService unit tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agents.embeddings import _hash_embedding, vector_to_pg
from app.agents.memory_service import MemoryService
from app.policy.service import PolicyService, load_default_policy


@pytest.fixture(autouse=True)
def mock_org_policy(monkeypatch):
    async def fake_policy(self, org_id: str):
        return load_default_policy()

    monkeypatch.setattr(PolicyService, "get_effective_policy", fake_policy)


@pytest.mark.asyncio
async def test_write_memory_inserts_record(monkeypatch):
    session = AsyncMock()
    session.execute = AsyncMock()

    async def fake_embed(text: str):
        return _hash_embedding(text), "hash_fallback"

    monkeypatch.setattr("app.agents.memory_service.embed_text", fake_embed)

    brain = MemoryService(session)
    memory_id = await brain.write_memory(
        org_id="11111111-1111-1111-1111-111111111111",
        type="decision",
        entity_type="meeting",
        entity_id="22222222-2222-2222-2222-222222222222",
        note="Décision test",
        source_module="meeting",
        source_id="22222222-2222-2222-2222-222222222222",
    )

    assert memory_id
    assert session.execute.await_count >= 1


@pytest.mark.asyncio
async def test_search_memory_ilike_fallback(monkeypatch):
    session = AsyncMock()
    call_count = 0

    row = MagicMock()
    row.mappings.return_value.all.return_value = [
        {
            "id": "aaa",
            "type": "decision",
            "entity_type": "meeting",
            "entity_id": "bbb",
            "note": "Budget alloué pour Matam",
            "source_module": "meeting",
            "source_id": "bbb",
        }
    ]

    async def execute_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("pgvector unavailable")
        return row

    session.execute = AsyncMock(side_effect=execute_side_effect)

    async def fake_embed(text: str):
        return _hash_embedding(text), "hash_fallback"

    monkeypatch.setattr("app.agents.memory_service.embed_text", fake_embed)

    brain = MemoryService(session)
    hits = await brain.search_memory(
        "11111111-1111-1111-1111-111111111111",
        "Matam",
        limit=5,
    )

    assert len(hits) == 1
    assert hits[0].note == "Budget alloué pour Matam"
    assert hits[0].type == "decision"


@pytest.mark.asyncio
async def test_get_who_owes_what_groups_by_user():
    session = AsyncMock()

    tasks_result = MagicMock()
    tasks_result.mappings.return_value.all.return_value = [
        {
            "user_id": "u1",
            "full_name": "Fatou",
            "item_id": "t1",
            "title": "Rédiger TDR",
            "due_date": None,
            "priority": "high",
            "source": "task",
            "source_id": "t1",
        }
    ]
    commitments_result = MagicMock()
    commitments_result.mappings.return_value.all.return_value = []
    actions_result = MagicMock()
    actions_result.mappings.return_value.all.return_value = []

    session.execute = AsyncMock(
        side_effect=[tasks_result, commitments_result, actions_result]
    )

    brain = MemoryService(session)
    grouped = await brain.get_who_owes_what("11111111-1111-1111-1111-111111111111")

    assert len(grouped) == 1
    assert grouped[0]["full_name"] == "Fatou"
    assert len(grouped[0]["items"]) == 1
    assert grouped[0]["items"][0]["title"] == "Rédiger TDR"


def test_vector_to_pg_format():
    vec = _hash_embedding("test")
    s = vector_to_pg(vec)
    assert s.startswith("[")
    assert s.endswith("]")
