"""Automation rule types and validation."""

from __future__ import annotations

from typing import Any

TRIGGER_TYPES = frozenset({
    "task_overdue",
    "task_created",
    "document_uploaded",
    "commitment_due",
    "field_report_submitted",
    "meeting_processed",
})

ACTION_TYPES = frozenset({
    "send_notification",
    "send_whatsapp",
    "create_pending_action",
    "notify_admin",
    "add_memory",
})

NOTIFY_ONLY_ACTIONS = frozenset({"send_notification", "notify_admin"})

TRIGGER_LABELS_FR: dict[str, str] = {
    "task_overdue": "Tâche en retard",
    "task_created": "Tâche créée",
    "document_uploaded": "Document téléversé",
    "commitment_due": "Engagement à échéance",
    "field_report_submitted": "Rapport terrain soumis",
    "meeting_processed": "Réunion traitée",
}

ACTION_LABELS_FR: dict[str, str] = {
    "send_notification": "Envoyer une notification",
    "send_whatsapp": "Envoyer un WhatsApp",
    "create_pending_action": "Créer une action (approbation)",
    "notify_admin": "Notifier les administrateurs",
    "add_memory": "Ajouter à la mémoire",
}


def validate_trigger_type(value: str) -> str:
    if value not in TRIGGER_TYPES:
        raise ValueError(f"Déclencheur inconnu: {value}")
    return value


def validate_action_type(value: str) -> str:
    if value not in ACTION_TYPES:
        raise ValueError(f"Action inconnue: {value}")
    return value


def matches_trigger_config(trigger_config: dict[str, Any] | None, context: dict[str, Any]) -> bool:
    if not trigger_config:
        return True
    for key, expected in trigger_config.items():
        if key not in context:
            return False
        if str(context[key]) != str(expected):
            return False
    return True


def render_template(value: str, context: dict[str, Any]) -> str:
    out = value
    for key, val in context.items():
        if val is None:
            continue
        out = out.replace(f"{{{{{key}}}}}", str(val))
    return out


def render_config(config: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    rendered: dict[str, Any] = {}
    for key, val in config.items():
        if isinstance(val, str):
            rendered[key] = render_template(val, context)
        elif isinstance(val, dict):
            rendered[key] = render_config(val, context)
        else:
            rendered[key] = val
    return rendered
