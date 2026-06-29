"""Evaluate and run automation rules on domain events."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.automation.models import (
    matches_trigger_config,
    render_config,
)
from app.automation.service import AutomationService
from app.delivery.push import send_push
from app.job_dedup import try_acquire_job_key
from app.services.pending_actions import create_pending_action

log = logging.getLogger(__name__)


async def _resolve_user_id(
    session: AsyncSession,
    target: str,
    context: dict[str, Any],
    org_id: str,
) -> str | None:
    if target == "assignee" and context.get("assignee_id"):
        return str(context["assignee_id"])
    if target == "creator" and context.get("created_by"):
        return str(context["created_by"])
    if target == "submitter" and context.get("submitted_by"):
        return str(context["submitted_by"])
    if target and target not in ("assignee", "creator", "submitter", "admin"):
        return target
    return None


async def _admin_user_ids(session: AsyncSession, org_id: str) -> list[str]:
    rows = (
        await session.execute(
            text(
                "SELECT u.id::text FROM users u"
                " JOIN org_memberships om ON om.user_id = u.id AND om.organization_id = u.organization_id"
                " WHERE u.organization_id = CAST(:oid AS uuid)"
                " AND om.role IN ('owner', 'admin') AND om.is_active = true"
            ).bindparams(oid=org_id),
        )
    ).scalars().all()
    return list(rows)


async def _execute_rule_action(
    session: AsyncSession,
    org_id: str,
    rule: dict[str, Any],
    context: dict[str, Any],
) -> None:
    action_type = rule["action_type"]
    action_config = render_config(rule.get("action_config") or {}, context)

    if action_type == "send_notification":
        user_id = await _resolve_user_id(session, action_config.get("target", "assignee"), context, org_id)
        if user_id:
            await send_push(
                session,
                user_id=user_id,
                title=action_config.get("title", "TeamBrain"),
                body=action_config.get("body", ""),
                data={"type": "automation", "rule_id": str(rule["id"])},
            )
        return

    if action_type == "notify_admin":
        title = action_config.get("title", "Alerte TeamBrain")
        body = action_config.get("body", "")
        for uid in await _admin_user_ids(session, org_id):
            await send_push(
                session,
                user_id=uid,
                title=title,
                body=body,
                data={"type": "automation_admin", "rule_id": str(rule["id"])},
            )
        return

    if action_type == "send_whatsapp":
        recipient_id = await _resolve_user_id(session, action_config.get("recipient", "assignee"), context, org_id)
        email = None
        name = None
        if recipient_id:
            row = (
                await session.execute(
                    text("SELECT email, full_name FROM users WHERE id = CAST(:uid AS uuid)").bindparams(
                        uid=recipient_id,
                    ),
                )
            ).mappings().first()
            if row:
                email = row["email"]
                name = row["full_name"]
        await create_pending_action(
            session,
            org_id=org_id,
            action_type="whatsapp_send",
            payload={
                "recipient_email": email,
                "recipient_name": name,
                "message": action_config.get("message", ""),
                "automation_rule_id": str(rule["id"]),
            },
            suggested_by="automation",
        )
        return

    if action_type == "create_pending_action":
        pending_type = action_config.get("pending_action_type", "create_task")
        payload = action_config.get("payload") or {}
        payload["automation_rule_id"] = str(rule["id"])
        await create_pending_action(
            session,
            org_id=org_id,
            action_type=pending_type,
            payload=payload,
            suggested_by="automation",
        )
        return

    if action_type == "add_memory":
        await create_pending_action(
            session,
            org_id=org_id,
            action_type="add_memory",
            payload={
                "note": action_config.get("note", ""),
                "memory_type": action_config.get("memory_type", "episodic"),
                "entity_type": action_config.get("entity_type", "message"),
                "entity_id": context.get("task_id") or context.get("document_id") or context.get("meeting_id"),
                "source_module": "automation",
                "automation_rule_id": str(rule["id"]),
            },
            suggested_by="automation",
        )
        return

    log.warning("automation_unknown_action", extra={"action_type": action_type})


async def run_automation_event(
    session: AsyncSession,
    *,
    org_id: str,
    trigger_type: str,
    context: dict[str, Any],
) -> int:
    """Evaluate active rules for trigger_type; returns count of rules fired."""
    svc = AutomationService(session)
    rules = await svc.get_active_for_trigger(org_id, trigger_type)
    fired = 0
    entity_key = (
        context.get("task_id")
        or context.get("document_id")
        or context.get("meeting_id")
        or context.get("commitment_id")
        or "event"
    )
    for rule in rules:
        trigger_config = rule.get("trigger_config") or {}
        if isinstance(trigger_config, str):
            import json

            trigger_config = json.loads(trigger_config)
        if not matches_trigger_config(trigger_config, context):
            continue
        dedup_key = f"auto:{rule['id']}:{entity_key}"
        if not await try_acquire_job_key(session, "automation_rules", dedup_key):
            continue
        try:
            await _execute_rule_action(session, org_id, rule, context)
            fired += 1
        except Exception as exc:
            log.exception("automation_rule_failed", extra={"rule_id": str(rule["id"]), "error": str(exc)})
    if fired:
        await session.commit()
    return fired
