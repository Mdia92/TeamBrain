"""Team Brain public interface — callable from any surface."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_loop import AgentResult, run_agent
from app.agents.memory_service import MemoryService

ACCOUNTABILITY_KEYWORDS = (
    "qui doit",
    "retard",
    "engagement",
    "en attente",
    "livrer",
    "overdue",
    "doit encore",
    "responsable",
    "échéance",
    "soumis",
    "rapport terrain",
)


class MemoryEntry:
    def __init__(
        self,
        id: str,
        type: str,
        entity_type: str | None,
        entity_id: str | None,
        note: str | None,
        source_module: str | None,
        source_id: str | None,
        similarity_score: float = 0.0,
    ) -> None:
        self.id = id
        self.type = type
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.note = note
        self.source_module = source_module
        self.source_id = source_id
        self.similarity_score = similarity_score


class AccountabilityReport:
    def __init__(self, people: list[dict] | None = None) -> None:
        self.people = people or []


class AssistantResponse:
    def __init__(
        self,
        answer: str,
        confidence: float,
        sources: list[str],
        model: str,
        confidence_label: str = "Moyenne",
        actions_taken: list[str] | None = None,
        pending_suggestions: list[dict[str, Any]] | None = None,
        api_configured: bool = True,
        grounded: bool = True,
    ) -> None:
        self.answer = answer
        self.confidence = confidence
        self.sources = sources
        self.model = model
        self.confidence_label = confidence_label
        self.actions_taken = actions_taken or []
        self.pending_suggestions = pending_suggestions or []
        self.api_configured = api_configured
        self.grounded = grounded


async def ingest(
    session: AsyncSession,
    org_id: str,
    content_type: str,
    content: str,
    metadata: dict[str, Any],
) -> MemoryEntry:
    brain = MemoryService(session)
    memory_id = await brain.write_memory(
        org_id=org_id,
        type=metadata.get("type", "episodic"),
        entity_type=metadata.get("entity_type", content_type),
        entity_id=metadata.get("entity_id"),
        note=content,
        source_module=metadata.get("source_module", content_type),
        source_id=metadata.get("source_id"),
    )
    return MemoryEntry(
        id=memory_id,
        type=metadata.get("type", "episodic"),
        entity_type=metadata.get("entity_type"),
        entity_id=metadata.get("entity_id"),
        note=content,
        source_module=metadata.get("source_module"),
        source_id=metadata.get("source_id"),
    )


async def search(
    session: AsyncSession,
    org_id: str,
    query: str,
    filters: dict[str, Any] | None = None,
) -> list[MemoryEntry]:
    brain = MemoryService(session)
    hits = await brain.search_memory(
        org_id,
        query,
        limit=filters.get("limit", 10) if filters else 10,
        type_filter=filters.get("type") if filters else None,
    )
    return [
        MemoryEntry(
            id=h.id,
            type=h.type,
            entity_type=h.entity_type,
            entity_id=h.entity_id,
            note=h.note,
            source_module=h.source_module,
            source_id=h.source_id,
            similarity_score=h.similarity_score,
        )
        for h in hits
    ]


async def get_accountability(session: AsyncSession, org_id: str) -> AccountabilityReport:
    brain = MemoryService(session)
    people = await brain.get_who_owes_what(org_id)
    return AccountabilityReport(people=people)


async def ask(
    session: AsyncSession,
    org_id: str,
    question: str,
    user_id: str | None = None,
) -> AssistantResponse:
    """Unified agentic assistant via MCP tool loop."""
    result: AgentResult = await run_agent(session, org_id, question, user_id=user_id)
    return AssistantResponse(
        answer=result.answer,
        confidence=result.confidence,
        sources=result.sources,
        model=result.model,
        confidence_label=result.confidence_label,
        actions_taken=result.actions_taken,
        pending_suggestions=result.pending_suggestions,
        api_configured=result.api_configured,
        grounded=result.grounded,
    )
