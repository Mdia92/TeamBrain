"""Documents Agent — perceive → reason → decide → execute → verify on upload."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import dateparser
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.services.module_findings import write_finding
from app.services.pending_actions import create_pending_action

log = structlog.get_logger("teambrain.documents_agent")

ACTION_VERBS = re.compile(
    r"\b(deliver|review|submit|pay|livrer|réviser|revoir|soumettre|payer|envoyer)\b",
    re.I,
)
DATE_ISO = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
DATE_SLASH = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{2,4})\b")
DATE_TEXT = re.compile(
    r"\b(\d{1,2}\s+(?:jan(?:vier)?|fév|feb|mar|avr|apr|mai|may|juin|jun|juil|jul|"
    r"août|aug|sep|oct|nov|déc|dec)\w*"
    r"|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)"
    r"\s+\d{1,2}(?:,?\s*\d{4})?)\b",
    re.I,
)
MONEY = re.compile(r"(\d[\d\s.,]*)\s*(FCFA|XOF|CFA|\$|USD|EUR)", re.I)
INVOICE = re.compile(r"\b(facture|invoice)\b", re.I)
REPORT = re.compile(r"\b(rapport|report)\b", re.I)
REVIEW = re.compile(r"\b(review|réviser|revoir|relire)\b", re.I)
DUE = re.compile(r"\b(due|échéance|deadline|avant le|before)\b", re.I)
AMBIGUOUS_DATE = re.compile(
    r"\b(sometime this week|cette semaine|bientôt|soon|end of month|fin du mois)\b",
    re.I,
)


@dataclass
class ExtractedSignal:
    signal_type: str
    content: str
    snippet: str
    confidence: float
    parsed_date: str | None = None
    amount: str | None = None
    person: str | None = None


@dataclass
class TaskSuggestion:
    title: str
    confidence: float
    finding_type: str
    content: str
    snippet: str
    needs_review: bool = False
    due_date: str | None = None
    keywords: list[str] = field(default_factory=list)


@dataclass
class DocumentsAgentResult:
    finding_ids: list[str] = field(default_factory=list)
    pending_action_ids: list[str] = field(default_factory=list)
    suggestions: list[TaskSuggestion] = field(default_factory=list)


def _line_snippet(text: str, line: str, window: int = 120) -> str:
    idx = text.find(line)
    if idx < 0:
        return line[:window]
    start = max(0, idx - 20)
    return text[start : start + window]


def _parse_date(value: str) -> tuple[str | None, float]:
    parsed = dateparser.parse(value, languages=["fr", "en"])
    if parsed:
        return parsed.date().isoformat(), 0.9
    return None, 0.55


async def _resolve_ambiguous_date(snippet: str) -> tuple[str | None, float]:
    prompt = (
        f'Phrase: "{snippet[:200]}"\n'
        "Convertis la date en ISO YYYY-MM-DD. Réponds uniquement avec la date ou UNKNOWN."
    )
    raw, _ = await generate_text(prompt, "Tu normalises des dates pour une ONG.")
    if not raw:
        return None, 0.5
    cleaned = raw.strip().split()[0]
    if DATE_ISO.match(cleaned):
        return cleaned, 0.72
    return None, 0.5


def reason_document(text: str, member_names: list[str]) -> list[ExtractedSignal]:
    """Rule-based extraction (80% deterministic)."""
    if not text or len(text.strip()) < 10:
        return []
    signals: list[ExtractedSignal] = []
    seen: set[str] = set()

    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 4:
            continue

        for match in DATE_ISO.finditer(line):
            key = f"date:{match.group(1)}"
            if key not in seen:
                seen.add(key)
                signals.append(
                    ExtractedSignal(
                        "date",
                        match.group(1),
                        _line_snippet(text, line),
                        0.92,
                        parsed_date=match.group(1),
                    )
                )

        for match in DATE_SLASH.finditer(line):
            iso, conf = _parse_date(match.group(1))
            if iso:
                key = f"date:{iso}"
                if key not in seen:
                    seen.add(key)
                    signals.append(
                        ExtractedSignal(
                            "date",
                            match.group(1),
                            _line_snippet(text, line),
                            conf,
                            parsed_date=iso,
                        )
                    )

        for match in DATE_TEXT.finditer(line):
            iso, conf = _parse_date(match.group(0))
            if iso:
                key = f"date:{iso}"
                if key not in seen:
                    seen.add(key)
                    signals.append(
                        ExtractedSignal(
                            "date",
                            match.group(0),
                            _line_snippet(text, line),
                            conf,
                            parsed_date=iso,
                        )
                    )

        if AMBIGUOUS_DATE.search(line):
            key = f"ambig:{line[:40]}"
            if key not in seen:
                seen.add(key)
                signals.append(
                    ExtractedSignal("date_ambiguous", line, _line_snippet(text, line), 0.55)
                )

        for match in MONEY.finditer(line):
            key = f"money:{match.group(0)}"
            if key not in seen:
                seen.add(key)
                signals.append(
                    ExtractedSignal(
                        "money",
                        match.group(0),
                        _line_snippet(text, line),
                        0.88,
                        amount=match.group(0),
                    )
                )

        if ACTION_VERBS.search(line):
            key = f"action:{line[:50]}"
            if key not in seen:
                seen.add(key)
                signals.append(
                    ExtractedSignal("action", line, _line_snippet(text, line), 0.78)
                )

        lower_line = line.lower()
        for name in member_names:
            if name and len(name) > 2 and name.lower() in lower_line:
                key = f"person:{name}"
                if key not in seen:
                    seen.add(key)
                    signals.append(
                        ExtractedSignal(
                            "person",
                            name,
                            _line_snippet(text, line),
                            0.85,
                            person=name,
                        )
                    )

        if INVOICE.search(line):
            key = f"invoice:{line[:40]}"
            if key not in seen:
                seen.add(key)
                signals.append(
                    ExtractedSignal("invoice", line, _line_snippet(text, line), 0.9)
                )

        if REPORT.search(line) and DUE.search(line):
            key = f"report:{line[:40]}"
            if key not in seen:
                seen.add(key)
                signals.append(
                    ExtractedSignal("report_deadline", line, _line_snippet(text, line), 0.82)
                )

    return signals


async def reason_document_async(text: str, member_names: list[str]) -> list[ExtractedSignal]:
    signals = reason_document(text, member_names)
    resolved: list[ExtractedSignal] = []
    for sig in signals:
        if sig.signal_type != "date_ambiguous":
            resolved.append(sig)
            continue
        iso, conf = await _resolve_ambiguous_date(sig.snippet)
        if iso:
            resolved.append(
                ExtractedSignal(
                    "date",
                    sig.content,
                    sig.snippet,
                    conf,
                    parsed_date=iso,
                )
            )
        else:
            resolved.append(sig)
    return resolved


def decide_tasks(signals: list[ExtractedSignal], text: str) -> list[TaskSuggestion]:
    """Map extracted signals to task shapes."""
    dates = [s for s in signals if s.signal_type == "date" and s.parsed_date]
    invoices = [s for s in signals if s.signal_type == "invoice"]
    reports = [s for s in signals if s.signal_type == "report_deadline"]
    reviews = [s for s in signals if s.signal_type == "action" and REVIEW.search(s.content)]
    people = [s for s in signals if s.signal_type == "person"]
    actions = [s for s in signals if s.signal_type == "action"]
    suggestions: list[TaskSuggestion] = []

    if invoices and dates:
        inv = invoices[0]
        due = dates[0]
        title = f"Payer la facture — échéance {due.parsed_date}"
        suggestions.append(
            TaskSuggestion(
                title=title,
                confidence=0.88,
                finding_type="deadline",
                content=f"{inv.content} | due {due.parsed_date}",
                snippet=inv.snippet,
                due_date=due.parsed_date,
                keywords=["invoice", "facture", "due", due.parsed_date or ""],
            )
        )

    if reports:
        rep = reports[0]
        due_date = dates[0].parsed_date if dates else None
        title = f"Livrer le rapport{f' — {due_date}' if due_date else ''}"
        conf = 0.8 if due_date else 0.68
        suggestions.append(
            TaskSuggestion(
                title=title,
                confidence=conf,
                finding_type="action_item",
                content=rep.content,
                snippet=rep.snippet,
                needs_review=conf < 0.75,
                due_date=due_date,
                keywords=["report", "rapport", "deliver", "livrer"],
            )
        )

    if reviews and people:
        rev = reviews[0]
        person = people[0]
        title = f"Réviser pour {person.person}"
        suggestions.append(
            TaskSuggestion(
                title=title,
                confidence=0.8,
                finding_type="action_item",
                content=f"{rev.content} ({person.person})",
                snippet=rev.snippet,
                keywords=["review", "réviser", person.person or ""],
            )
        )

    if DUE.search(text) and dates and not suggestions:
        due = dates[0]
        line = due.snippet
        title = f"Suivi échéance — {due.parsed_date}"
        suggestions.append(
            TaskSuggestion(
                title=title,
                confidence=0.76,
                finding_type="deadline",
                content=line,
                snippet=due.snippet,
                due_date=due.parsed_date,
                keywords=["due", "échéance", due.parsed_date or ""],
            )
        )

    for act in actions[:3]:
        if any(s.snippet == act.snippet for s in suggestions):
            continue
        suggestions.append(
            TaskSuggestion(
                title=f"Action: {act.content[:80]}",
                confidence=0.62,
                finding_type="action_item",
                content=act.content,
                snippet=act.snippet,
                needs_review=True,
                keywords=ACTION_VERBS.findall(act.content.lower()),
            )
        )

    # Invoice + due in same document without explicit invoice signal line
    if not suggestions and INVOICE.search(text) and dates:
        due = dates[0]
        if DUE.search(text) or "due" in text.lower():
            suggestions.append(
                TaskSuggestion(
                    title=f"Payer la facture — échéance {due.parsed_date}",
                    confidence=0.85,
                    finding_type="deadline",
                    content=f"Invoice due {due.content}",
                    snippet=due.snippet,
                    due_date=due.parsed_date,
                    keywords=["invoice", "due", due.parsed_date or ""],
                )
            )

    return suggestions[:8]


def verify_suggestion(suggestion: TaskSuggestion, text: str) -> bool:
    """Re-read snippet — reject suggestions not grounded in source text."""
    if suggestion.snippet.strip() and suggestion.snippet not in text:
        return False
    haystack = f"{text}\n{suggestion.snippet}".lower()
    hits = 0
    for kw in suggestion.keywords:
        if kw and kw.lower() in haystack:
            hits += 1
    if suggestion.due_date and suggestion.due_date in haystack:
        hits += 1
    if suggestion.finding_type == "deadline" and ("due" in haystack or "échéance" in haystack):
        hits += 1
    required = 1 if len(suggestion.keywords) <= 1 else 2
    return hits >= required


async def _load_member_names(session: AsyncSession, org_id: str) -> list[str]:
    rows = (
        await session.execute(
            text(
                "SELECT u.full_name FROM users u"
                " JOIN org_memberships om ON om.user_id = u.id"
                " WHERE om.organization_id = CAST(:oid AS uuid) AND om.is_active = true"
                " AND u.full_name IS NOT NULL"
            ).bindparams(oid=org_id),
        )
    ).scalars().all()
    return [str(n).strip() for n in rows if n]


async def run_documents_agent(
    session: AsyncSession,
    *,
    org_id: str,
    document_id: str,
    title: str,
    text_content: str,
) -> DocumentsAgentResult:
    """Full agent loop after document text extraction + summarize."""
    result = DocumentsAgentResult()
    if not text_content or len(text_content.strip()) < 10:
        return result

    members = await _load_member_names(session, org_id)
    signals = await reason_document_async(text_content, members)
    suggestions = decide_tasks(signals, text_content)
    result.suggestions = suggestions

    for sig in signals:
        if sig.confidence < 0.5:
            continue
        fid = await write_finding(
            session,
            org_id=org_id,
            module="documents",
            finding_type="entity" if sig.signal_type not in ("date", "money", "action") else sig.signal_type,
            content=sig.content[:500],
            confidence=sig.confidence,
            source_id=document_id,
        )
        result.finding_ids.append(fid)

    for sug in suggestions:
        if sug.confidence < 0.5:
            continue
        fid = await write_finding(
            session,
            org_id=org_id,
            module="documents",
            finding_type=sug.finding_type,
            content=sug.content[:500],
            confidence=sug.confidence,
            source_id=document_id,
        )
        result.finding_ids.append(fid)

        if sug.confidence >= 0.75:
            if not verify_suggestion(sug, text_content):
                log.warning(
                    "documents_agent_verify_failed",
                    document_id=document_id,
                    title=sug.title,
                )
                continue
            payload: dict[str, Any] = {
                "title": sug.title,
                "source_finding": fid,
                "source_document_id": document_id,
                "document_title": title,
            }
            if sug.due_date:
                payload["due_date"] = sug.due_date
            action_id = await create_pending_action(
                session,
                org_id=org_id,
                action_type="task_suggestion",
                payload=payload,
                suggested_by="documents_agent",
            )
            result.pending_action_ids.append(action_id)
        elif sug.needs_review or 0.5 <= sug.confidence < 0.75:
            await write_finding(
                session,
                org_id=org_id,
                module="documents",
                finding_type="action_item",
                content=f"[revue requise] {sug.content}"[:500],
                confidence=sug.confidence,
                source_id=document_id,
            )

    return result
