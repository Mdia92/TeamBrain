"""Rules-first engine — deterministic decisions before LLM."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass
class RuleResult:
    action: str
    confidence: float
    explanation: str


def is_task_overdue(due_date: date | None, status: str) -> RuleResult | None:
    if not due_date or status == "done":
        return None
    if due_date < date.today():
        days = (date.today() - due_date).days
        return RuleResult(
            action="notify_overdue",
            confidence=1.0,
            explanation=f"Tâche en retard de {days} jour(s)",
        )
    return None


def should_send_commitment_reminder(deadline: date | None, is_fulfilled: bool, reminder_sent: bool) -> RuleResult | None:
    if is_fulfilled or reminder_sent or not deadline:
        return None
    if deadline < date.today():
        return RuleResult(
            action="whatsapp_reminder",
            confidence=1.0,
            explanation="Engagement non honoré — rappel WhatsApp",
        )
    return None
