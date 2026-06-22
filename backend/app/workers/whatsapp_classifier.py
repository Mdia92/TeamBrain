"""WhatsApp message classifier — rules first, LLM for ambiguous."""

from __future__ import annotations

import re

from app.agents.llm_client import generate_text

CATEGORIES = ("status_update", "field_report", "question", "task_update", "meeting_note")


def classify_by_rules(text: str) -> str | None:
    lower = text.lower().strip()
    if re.search(r"\b(terminé|fini|done|complété)\b", lower) and re.search(
        r"\b(tâche|task)\b", lower
    ):
        return "task_update"
    if re.search(r"\b(rapport|mission|terrain|field)\b", lower):
        return "field_report"
    if re.search(r"\b(réunion|meeting|engagement|engagé)\b", lower):
        return "meeting_note"
    if text.strip().endswith("?"):
        return "question"
    if len(lower.split()) <= 30 and not text.strip().endswith("?"):
        return "status_update"
    return None


async def classify_whatsapp_message(text: str) -> tuple[str, float]:
    rule_result = classify_by_rules(text)
    if rule_result:
        return rule_result, 0.95

    prompt = (
        f"Catégorise ce message WhatsApp: {text}\n"
        f"Catégories: {', '.join(CATEGORIES)}\n"
        "Réponds avec une seule catégorie."
    )
    raw, _ = await generate_text(prompt, "Tu es un classificateur de messages.")
    for cat in CATEGORIES:
        if cat in raw.lower():
            return cat, 0.7
    return "status_update", 0.5
