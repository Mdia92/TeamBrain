"""Team Brain public interface — callable from any surface."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.agents.memory_service import MemoryService

ASSISTANT_SYSTEM = """Tu es l'assistant TeamBrain. Réponds en français.
Base-toi UNIQUEMENT sur le contexte fourni. Cite toujours tes sources avec source_module
et source_id. Si tu n'es pas certain, dis-le clairement.
Réponds en JSON: {"answer": "...", "confidence": 0.0-1.0, "sources": ["module:id — note"]}"""

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


@dataclass
class MemoryEntry:
    id: str
    type: str
    entity_type: str | None
    entity_id: str | None
    note: str | None
    source_module: str | None
    source_id: str | None
    similarity_score: float = 0.0


@dataclass
class AccountabilityReport:
    people: list[dict] = field(default_factory=list)


@dataclass
class AssistantResponse:
    answer: str
    confidence: float
    sources: list[str]
    model: str


def _needs_accountability(question: str) -> bool:
    lower = question.lower()
    return any(kw in lower for kw in ACCOUNTABILITY_KEYWORDS)


async def ingest(
    session: AsyncSession,
    org_id: str,
    content_type: str,
    content: str,
    metadata: dict[str, Any],
) -> MemoryEntry:
    """Write to the unified brain."""
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
    """Unified brain-powered assistant."""
    brain = MemoryService(session)

    memories = await brain.search_memory(org_id, question, limit=12)
    hydrated = [await brain.hydrate_memory(m) for m in memories[:8]]

    context_parts: list[str] = []
    for h in hydrated:
        mem = h["memory"]
        src = f"{mem.source_module}:{mem.source_id}" if mem.source_module else "mémoire"
        context_parts.append(f"[{src}] ({mem.type}) {mem.note}")
        if h.get("source_detail"):
            context_parts.append(f"  Détail: {json.dumps(h['source_detail'], default=str)}")

    if _needs_accountability(question):
        accountability = await brain.get_who_owes_what(org_id)
        if accountability:
            context_parts.append(
                "Responsabilités ouvertes: " + json.dumps(accountability, default=str)
            )

    # Project status fallback from live data when query mentions a project name
    project_rows = (
        await session.execute(
            text(
                "SELECT p.name, p.status, p.client_name,"
                " (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_tasks"
                " FROM projects p WHERE p.organization_id = CAST(:oid AS uuid)"
            ).bindparams(oid=org_id),
        )
    ).mappings().all()
    if project_rows:
        context_parts.append("Projets: " + json.dumps([dict(r) for r in project_rows], default=str))

    # Field report gap for agents this week
    if "rapport" in question.lower():
        gap_rows = (
            await session.execute(
                text(
                    "SELECT u.full_name FROM users u"
                    " WHERE u.organization_id = CAST(:oid AS uuid)"
                    " AND u.role = 'field_agent'"
                    " AND NOT EXISTS ("
                    "   SELECT 1 FROM field_reports fr"
                    "   WHERE fr.submitted_by = u.id"
                    "   AND fr.mission_date >= CURRENT_DATE - INTERVAL '7 days'"
                    " )"
                ).bindparams(oid=org_id),
            )
        ).mappings().all()
        if gap_rows:
            names = [r["full_name"] for r in gap_rows]
            context_parts.append(f"Agents sans rapport cette semaine: {', '.join(names)}")

    context = "\n".join(context_parts) or "Aucune mémoire pertinente trouvée."
    prompt = f"Contexte organisation:\n{context}\n\nQuestion: {question}"
    if user_id:
        prompt += f"\n(Demandé par user_id: {user_id})"

    raw, model = await generate_text(prompt, ASSISTANT_SYSTEM)

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            sources = data.get("sources", [])
            for m in memories[:5]:
                src = f"{m.source_module}:{m.source_id}"
                if src not in sources and m.note:
                    sources.append(f"{src} — {m.note[:80]}")
            return AssistantResponse(
                answer=data.get("answer", raw),
                confidence=float(data.get("confidence", 0.7)),
                sources=sources,
                model=model,
            )
        except (json.JSONDecodeError, ValueError):
            pass

    sources = [f"{m.source_module}:{m.source_id}" for m in memories[:3] if m.source_module]
    return AssistantResponse(
        answer=raw,
        confidence=0.5,
        sources=sources or ["mémoire interne"],
        model=model,
    )
