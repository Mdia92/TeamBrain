"""Meetings Agent — WhatsApp group voice capture: perceive → reason → decide → execute → verify."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

import dateparser
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.agents.meeting_extractor import MeetingExtraction, extract_meeting_intelligence
from app.agents.memory_service import MemoryService
from app.services.module_findings import write_finding
from app.services.pending_actions import create_pending_action
from app.services.whatsapp_media import extract_speaker_names

log = structlog.get_logger("teambrain.meetings_agent")

DECISION_RE = re.compile(
    r"\b(we decided|nous avons décidé|nous avons decide|décidé de|decided to|il a été décidé)\b",
    re.I,
)
COMMITMENT_RE = re.compile(
    r"\b(will\b|va\s|doit\s|responsible for|responsable de|s'engage|commit to|chargé de)\b",
    re.I,
)
DEADLINE_RE = re.compile(
    r"\b(by\s+\w+|avant\s+(?:le\s+)?\w+|d'ici\s+\w+|before\s+\w+|juin|june|july|juillet|"
    r"january|janvier|february|février|march|mars|april|avril|may|mai|august|août|"
    r"september|septembre|october|octobre|november|novembre|december|décembre)\b",
    re.I,
)

MEETING_CONFIDENCE_MIN = 0.7
PENDING_ACTION_CONFIDENCE_MIN = 0.8


@dataclass
class MeetingsAgentResult:
    finding_ids: list[str] = field(default_factory=list)
    pending_action_ids: list[str] = field(default_factory=list)
    summary: str = ""
    confidence: float = 0.0
    unmapped_people: list[str] = field(default_factory=list)
    skipped: bool = False
    skip_reason: str | None = None


@dataclass
class PerceivedWhatsAppMeeting:
    audio_url: str | None
    group_id: str | None
    sender_name: str | None
    caption: str
    timestamp: str | None = None


def _parse_deadline(snippet: str) -> str | None:
    parsed = dateparser.parse(snippet, languages=["fr", "en"])
    if parsed:
        return parsed.date().isoformat()
    return None


def rule_extract_meeting(transcript: str) -> MeetingExtraction:
    """Deterministic fallback when LLM is unavailable."""
    decisions: list[str] = []
    commitments: list[str] = []
    action_items: list[dict[str, Any]] = []

    for line in transcript.splitlines():
        line = line.strip()
        if not line:
            continue
        if DECISION_RE.search(line):
            decisions.append(line[:300])
        elif COMMITMENT_RE.search(line):
            commitments.append(line[:300])
            due = _parse_deadline(line) if DEADLINE_RE.search(line) else None
            action_items.append(
                {
                    "description": line[:200],
                    "assignee_name": None,
                    "due_date": due,
                }
            )

    if not decisions and DECISION_RE.search(transcript):
        idx = DECISION_RE.search(transcript)
        if idx:
            decisions.append(transcript[idx.start() : idx.start() + 200].strip())

    summary = transcript[:400] if transcript else "Réunion WhatsApp"
    if decisions:
        summary = decisions[0][:400]

    from app.agents.meeting_extractor import ActionItem, Commitment, MeetingExtraction

    return MeetingExtraction(
        summary=summary,
        decisions=decisions[:5],
        commitments=[
            Commitment(text=c, person_name=None, deadline=None) for c in commitments[:5]
        ],
        action_items=[
            ActionItem(
                description=a["description"],
                assignee_name=a.get("assignee_name"),
                due_date=a.get("due_date"),
            )
            for a in action_items[:8]
        ],
        key_topics=["whatsapp_group"],
    )


async def reason_whatsapp_meeting(transcript: str) -> tuple[MeetingExtraction, float, str]:
    """LLM extraction + focused meeting prompts."""
    if not transcript or len(transcript.strip()) < 8:
        return MeetingExtraction(summary=""), 0.0, ""

    extraction, _model = await extract_meeting_intelligence(transcript)
    if not extraction.decisions and not extraction.action_items and not extraction.commitments:
        extraction = rule_extract_meeting(transcript)

    top_decisions_raw, _ = await generate_text(
        f"Transcription:\n{transcript[:8000]}\n\n"
        "Quelles sont les 3 décisions les plus importantes de cette équipe ? "
        "Liste courte, une par ligne.",
        "Tu analyses des réunions d'équipe en français ou anglais.",
    )
    if top_decisions_raw:
        extra = [ln.strip("-• ").strip() for ln in top_decisions_raw.splitlines() if ln.strip()][:3]
        for d in extra:
            if d and d not in extraction.decisions:
                extraction.decisions.append(d)

    commitments_raw, _ = await generate_text(
        f"Transcription:\n{transcript[:8000]}\n\n"
        "Qui s'est engagé à faire quoi, et pour quand ? Format: Nom — action — date",
        "Tu extrais les engagements explicites des réunions.",
    )
    if commitments_raw:
        for ln in commitments_raw.splitlines():
            ln = ln.strip("-• ").strip()
            if ln and not any(ln in c.text for c in extraction.commitments):
                from app.agents.meeting_extractor import Commitment

                extraction.commitments.append(Commitment(text=ln, person_name=None, deadline=None))

    base = 0.72
    if extraction.decisions:
        base += 0.08
    if extraction.commitments or extraction.action_items:
        base += 0.08
    if len(extract_speaker_names(transcript)) >= 2:
        base += 0.05
    confidence = min(0.95, max(MEETING_CONFIDENCE_MIN, base))
    return extraction, confidence, transcript[:500]


def map_people_to_members(names: list[str], members: list[str]) -> tuple[list[dict[str, str]], list[str]]:
    mapped: list[dict[str, str]] = []
    unmapped: list[str] = []
    member_by_lower = {m.lower(): m for m in members}

    for raw in names:
        name = raw.strip()
        if not name:
            continue
        low = name.lower()
        if low in member_by_lower:
            mapped.append({"mentioned": name, "member": member_by_lower[low]})
            continue
        partial = next((m for m in members if low in m.lower() or m.lower().split()[0] == low.split()[0]), None)
        if partial:
            mapped.append({"mentioned": name, "member": partial})
        else:
            unmapped.append(name)
    return mapped, unmapped


def verify_extraction(
    extraction: MeetingExtraction,
    transcript: str,
    members: list[str],
) -> tuple[bool, list[str]]:
    snippet = transcript[:2000].lower()
    grounded = False
    for d in extraction.decisions:
        if d[:40].lower() in snippet or any(w in snippet for w in d.lower().split()[:4] if len(w) > 4):
            grounded = True
            break
    if not grounded and (extraction.commitments or extraction.action_items):
        grounded = any(c.text[:30].lower() in snippet for c in extraction.commitments)

    speaker_names = extract_speaker_names(transcript)
    people_mentioned: list[str] = list(speaker_names)
    for item in extraction.action_items:
        if item.assignee_name:
            people_mentioned.append(item.assignee_name)
    for c in extraction.commitments:
        if c.person_name:
            people_mentioned.append(c.person_name)

    _, unmapped = map_people_to_members(people_mentioned, members)
    if not extraction.decisions and not extraction.commitments and not extraction.action_items:
        return False, unmapped
    return grounded or len(transcript) > 30, unmapped


async def _load_member_names(session: AsyncSession, org_id: str) -> list[str]:
    rows = (
        await session.execute(
            text(
                "SELECT u.full_name FROM users u"
                " JOIN org_memberships om ON om.user_id = u.id"
                " WHERE om.organization_id = CAST(:oid AS uuid) AND om.is_active = true"
            ).bindparams(oid=org_id),
        )
    ).scalars().all()
    return [str(n).strip() for n in rows if n]


async def run_meetings_agent(
    session: AsyncSession,
    *,
    org_id: str,
    transcript: str,
    perceived: PerceivedWhatsAppMeeting,
    source_user_id: str | None = None,
) -> MeetingsAgentResult:
    """Full agent loop after WhatsApp group audio transcription."""
    result = MeetingsAgentResult()
    if not transcript or len(transcript.strip()) < 8:
        result.skipped = True
        result.skip_reason = "transcript_too_short"
        return result

    members = await _load_member_names(session, org_id)
    extraction, confidence, snippet = await reason_whatsapp_meeting(transcript)
    grounded, unmapped = verify_extraction(extraction, transcript, members)
    result.unmapped_people = unmapped
    result.confidence = confidence if grounded else max(0.5, confidence - 0.2)
    result.summary = extraction.summary or snippet

    if result.confidence < MEETING_CONFIDENCE_MIN:
        result.skipped = True
        result.skip_reason = "low_confidence"
        return result

    source_id = source_user_id
    meeting_note_content = json.dumps(
        {
            "subtype": "whatsapp_group",
            "summary": result.summary,
            "group_id": perceived.group_id,
            "sender_name": perceived.sender_name,
            "caption": perceived.caption[:500],
            "unmapped_people": unmapped,
        },
        ensure_ascii=False,
    )

    fid = await write_finding(
        session,
        org_id=org_id,
        module="meetings",
        finding_type="meeting_note",
        content=meeting_note_content[:4000],
        confidence=result.confidence,
        source_id=source_id,
    )
    result.finding_ids.append(fid)

    for decision in extraction.decisions[:5]:
        result.finding_ids.append(
            await write_finding(
                session,
                org_id=org_id,
                module="meetings",
                finding_type="decision",
                content=decision[:500],
                confidence=min(0.95, result.confidence + 0.05),
                source_id=source_id,
            )
        )

    for commitment in extraction.commitments[:5]:
        result.finding_ids.append(
            await write_finding(
                session,
                org_id=org_id,
                module="meetings",
                finding_type="commitment",
                content=commitment.text[:500],
                confidence=result.confidence,
                source_id=source_id,
            )
        )

    for item in extraction.action_items[:8]:
        result.finding_ids.append(
            await write_finding(
                session,
                org_id=org_id,
                module="meetings",
                finding_type="action_item",
                content=item.description[:500],
                confidence=result.confidence,
                source_id=source_id,
            )
        )

    if result.confidence >= PENDING_ACTION_CONFIDENCE_MIN:
        suggested_tasks = [
            {
                "title": item.description[:200],
                "assignee_name": item.assignee_name,
                "due_date": item.due_date,
            }
            for item in extraction.action_items[:6]
        ]
        if not suggested_tasks and extraction.decisions:
            suggested_tasks = [{"title": d[:200], "assignee_name": None, "due_date": None} for d in extraction.decisions[:3]]

        payload: dict[str, Any] = {
            "summary": result.summary,
            "subtype": "whatsapp_group",
            "group_id": perceived.group_id,
            "sender_name": perceived.sender_name,
            "decisions": extraction.decisions[:5],
            "commitments": [c.text for c in extraction.commitments[:5]],
            "suggested_tasks": suggested_tasks,
            "unmapped_people": unmapped,
            "transcript_snippet": snippet,
            "confidence": result.confidence,
            "finding_ids": result.finding_ids,
            "dashboard_message": f"WhatsApp meeting captured: {result.summary[:120]}",
        }
        action_id = await create_pending_action(
            session,
            org_id=org_id,
            action_type="meeting_suggestion",
            payload=payload,
            suggested_by="meetings_agent",
        )
        result.pending_action_ids.append(action_id)

    brain = MemoryService(session)
    await brain.write_memory(
        org_id=org_id,
        type="decision" if extraction.decisions else "episodic",
        entity_type="meeting",
        entity_id=source_id,
        note=f"[WhatsApp groupe] {result.summary[:400]}",
        source_module="whatsapp",
        source_id=source_id,
    )

    return result

