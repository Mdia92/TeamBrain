"""WhatsApp message classifier — rules first, LLM for ambiguous; filters noise."""

from __future__ import annotations

import re

from app.agents.llm_client import generate_text

CATEGORIES = (
    "status_update",
    "field_report",
    "question",
    "task_update",
    "meeting_note",
    "commitment",
    "irrelevant",
)

# Casual / off-topic patterns — discard without memory write
_IRRELEVANT_RE = re.compile(
    r"^(\s*(mdr|lol|haha|😂|🤣|ok|oui|non|salut|cc|coucou|bonjour|bonsoir)\s*[!.?]*)+$",
    re.I,
)
_JOKE_RE = re.compile(r"\b(blague|rigole|ptdr|xd)\b", re.I)


def classify_by_rules(text: str) -> str | None:
    lower = text.lower().strip()
    if len(lower) < 3:
        return "irrelevant"
    if _IRRELEVANT_RE.match(lower) or _JOKE_RE.search(lower):
        return "irrelevant"
    if re.search(r"\b(terminé|fini|done|complété)\b", lower) and re.search(
        r"\b(tâche|task)\b", lower
    ):
        return "task_update"
    if re.search(r"\b(rapport|mission|terrain|field|parcelle|récolte)\b", lower):
        return "field_report"
    if re.search(r"\b(réunion|meeting|engagement|engagé|décision)\b", lower):
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
        f"Catégorise ce message WhatsApp professionnel: {text}\n"
        f"Catégories: {', '.join(CATEGORIES)}\n"
        "Utilise 'irrelevant' pour blagues, bavardage sans valeur métier.\n"
        "Réponds avec une seule catégorie."
    )
    raw, _ = await generate_text(prompt, "Tu es un classificateur de messages WhatsApp pour ONG et entreprises.")
    lower = raw.lower()
    for cat in CATEGORIES:
        if cat in lower:
            return cat, 0.7
    return "status_update", 0.5


def should_persist_to_memory(category: str) -> bool:
    return category not in ("irrelevant",)
