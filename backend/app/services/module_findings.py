"""Cross-module findings — coordination layer for Team Brain."""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

FINDING_TYPES = frozenset(
    {
        "deadline",
        "commitment",
        "decision",
        "action_item",
        "task_event",
        "entity",
        "meeting_note",
    }
)


async def write_finding(
    session: AsyncSession,
    *,
    org_id: str,
    module: str,
    finding_type: str,
    content: str,
    confidence: float,
    source_id: str | None = None,
) -> str:
    if finding_type not in FINDING_TYPES:
        finding_type = "entity"
    fid = str(uuid.uuid4())
    conf = max(0.0, min(1.0, float(confidence)))
    await session.execute(
        text(
            "INSERT INTO module_findings"
            " (id, organization_id, module, finding_type, content, confidence, source_id)"
            " VALUES (CAST(:id AS uuid), CAST(:oid AS uuid), :mod, :ftype, :content, :conf,"
            " CAST(:sid AS uuid))"
        ).bindparams(
            id=fid,
            oid=org_id,
            mod=module,
            ftype=finding_type,
            content=content[:4000],
            conf=conf,
            sid=source_id,
        ),
    )
    return fid


async def list_findings(
    session: AsyncSession,
    org_id: str,
    *,
    hours: int = 24,
    limit: int = 100,
) -> list[dict]:
    rows = (
        await session.execute(
            text(
                "SELECT id, module, finding_type, content, confidence, source_id, created_at"
                " FROM module_findings"
                " WHERE organization_id = CAST(:oid AS uuid)"
                " AND created_at >= now() - make_interval(hours => :hrs)"
                " ORDER BY created_at DESC LIMIT :lim"
            ).bindparams(oid=org_id, hrs=hours, lim=limit),
        )
    ).mappings().all()
    return [
        {
            **dict(r),
            "id": str(r["id"]),
            "source_id": str(r["source_id"]) if r.get("source_id") else None,
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        }
        for r in rows
    ]


def format_findings_for_context(findings: list[dict]) -> str:
    if not findings:
        return ""
    by_module: dict[str, list[str]] = defaultdict(list)
    for f in findings:
        by_module[f["module"]].append(f"{f['finding_type']}: {f['content']}")
    lines = ["Activité modules (24h):"]
    for mod, items in by_module.items():
        lines.append(f"- {mod}: " + "; ".join(items[:5]))
    return "\n".join(lines)


def synthesize_findings(findings: list[dict]) -> dict[str, Any]:
    """Deterministic rollup for /api/org/synthesis."""
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    highlights: list[dict] = []
    for f in findings:
        counts[f["module"]][f["finding_type"]] += 1
        if float(f.get("confidence") or 0) >= 0.8 and len(highlights) < 12:
            highlights.append(
                {
                    "module": f["module"],
                    "finding_type": f["finding_type"],
                    "content": f["content"],
                    "confidence": f["confidence"],
                    "source_id": f.get("source_id"),
                }
            )
    summary_parts = []
    for mod, types in counts.items():
        bits = ", ".join(f"{n} {t}" for t, n in types.items())
        summary_parts.append(f"{mod}: {bits}")
    narrative = (
        "Dernières 24h — " + "; ".join(summary_parts)
        if summary_parts
        else "Aucune activité module enregistrée sur les dernières 24h."
    )
    return {
        "counts_by_module": {m: dict(t) for m, t in counts.items()},
        "highlights": highlights,
        "narrative": narrative,
        "total": len(findings),
    }


async def ingest_document_findings(
    session: AsyncSession,
    *,
    org_id: str,
    document_id: str,
    title: str,
    text_content: str,
) -> list[str]:
    """Delegate to Documents Agent loop (perceive → reason → decide → execute → verify)."""
    from app.agents.documents_agent import run_documents_agent

    result = await run_documents_agent(
        session,
        org_id=org_id,
        document_id=document_id,
        title=title,
        text_content=text_content,
    )
    return result.finding_ids


async def ingest_meeting_findings(
    session: AsyncSession,
    *,
    org_id: str,
    meeting_id: str,
    decisions: list[str],
    commitments: list[str],
    action_items: list[Any],
) -> None:
    for d in decisions[:10]:
        await write_finding(
            session,
            org_id=org_id,
            module="meetings",
            finding_type="decision",
            content=d,
            confidence=0.88,
            source_id=meeting_id,
        )
    for c in commitments[:10]:
        await write_finding(
            session,
            org_id=org_id,
            module="meetings",
            finding_type="commitment",
            content=c,
            confidence=0.88,
            source_id=meeting_id,
        )
    for item in action_items[:15]:
        desc = getattr(item, "description", None) or str(item)
        await write_finding(
            session,
            org_id=org_id,
            module="meetings",
            finding_type="action_item",
            content=desc,
            confidence=0.9,
            source_id=meeting_id,
        )


async def ingest_task_event(
    session: AsyncSession,
    *,
    org_id: str,
    task_id: str,
    summary: str,
) -> None:
    await write_finding(
        session,
        org_id=org_id,
        module="tasks",
        finding_type="task_event",
        content=summary,
        confidence=1.0,
        source_id=task_id,
    )
