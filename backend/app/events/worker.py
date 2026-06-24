"""Event-driven closed loops — rules-first with Team Brain memory writes."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.delivery.push import send_push
from app.delivery.whatsapp import whatsapp_client
from app.job_dedup import try_acquire_job_key
from app.policy import PolicyService
from app.policy.models import OrgPolicy


async def _policy_cache(session: AsyncSession, org_id: str, cache: dict[str, OrgPolicy]) -> OrgPolicy:
    if org_id not in cache:
        cache[org_id] = await PolicyService(session).get_effective_policy(org_id)
    return cache[org_id]


def _within_commitment_reminder_window(deadline: date, hours_before: int) -> bool:
    if not deadline:
        return False
    delta_hours = (deadline - date.today()).days * 24
    return delta_hours <= hours_before


async def job_overdue_task_alerts(session: AsyncSession) -> int:
    brain = MemoryService(session)
    policy_svc = PolicyService(session)
    org_rows = (
        await session.execute(text("SELECT id FROM organizations"))
    ).mappings().all()
    count = 0
    for org in org_rows:
        org_id = str(org["id"])
        policy = await policy_svc.get_effective_policy(org_id)
        rows = (
            await session.execute(
                text(
                    "SELECT t.id, t.title, t.due_date, t.organization_id, t.assignee_id,"
                    " u.full_name, u.email"
                    " FROM tasks t"
                    " JOIN users u ON u.id = t.assignee_id"
                    " WHERE t.organization_id = CAST(:oid AS uuid)"
                    " AND t.status != 'done'"
                    " AND t.due_date IS NOT NULL"
                    " AND t.due_date < CURRENT_DATE - CAST(:days AS integer) * INTERVAL '1 day'"
                ).bindparams(oid=org_id, days=policy.overdue_task_days),
            )
        ).mappings().all()

        for row in rows:
            dedup_key = f"overdue:{row['id']}"
            if not await try_acquire_job_key(session, "overdue_tasks", dedup_key):
                continue
            msg = f"Rappel: la tâche « {row['title']} » est en retard."
            if row.get("email"):
                whatsapp_client.send_message(row["email"], msg)
            if row.get("assignee_id"):
                await send_push(
                    session,
                    user_id=str(row["assignee_id"]),
                    title="Tâche en retard",
                    body=msg,
                    data={"type": "overdue_task", "task_id": str(row["id"])},
                )
            await brain.write_memory(
                org_id=org_id,
                type="episodic",
                entity_type="task",
                entity_id=str(row["id"]),
                note=f"Overdue task reminder sent: {row['title']} to {row['full_name']}",
                source_module="events",
                source_id=str(row["id"]),
            )
            count += 1
    if count:
        await session.commit()
    return count


async def job_commitment_reminders(session: AsyncSession) -> int:
    brain = MemoryService(session)
    policy_svc = PolicyService(session)
    cache: dict[str, OrgPolicy] = {}
    rows = (
        await session.execute(
            text(
                "SELECT mc.id, mc.commitment_text, mc.deadline, mc.meeting_id, mc.committed_by,"
                " m.organization_id, u.full_name, u.email"
                " FROM meeting_commitments mc"
                " JOIN meetings m ON m.id = mc.meeting_id"
                " LEFT JOIN users u ON u.id = mc.committed_by"
                " WHERE mc.is_fulfilled = false AND mc.reminder_sent = false"
                " AND mc.deadline IS NOT NULL"
            ),
        )
    ).mappings().all()

    count = 0
    for row in rows:
        org_id = str(row["organization_id"])
        policy = await _policy_cache(session, org_id, cache)
        if not _within_commitment_reminder_window(row["deadline"], policy.commitment_reminder_hours_before):
            continue
        msg = (
            f"Vous vous étiez engagé à {row['commitment_text']}."
            f" Échéance: {row['deadline']}."
        )
        if row.get("email"):
            whatsapp_client.send_message(row["email"], msg)
        if row.get("committed_by"):
            await send_push(
                session,
                user_id=str(row["committed_by"]),
                title="Rappel d'engagement",
                body=msg,
                data={"type": "commitment", "meeting_id": str(row["meeting_id"])},
            )
        await session.execute(
            text(
                "UPDATE meeting_commitments SET reminder_sent = true WHERE id = :id"
            ).bindparams(id=row["id"]),
        )
        await brain.write_memory(
            org_id=org_id,
            type="commitment",
            entity_type="meeting",
            entity_id=str(row["meeting_id"]),
            note=f"Commitment reminder sent: {row['commitment_text']} to {row['full_name']}",
            source_module="events",
            source_id=str(row["meeting_id"]),
        )
        count += 1
    if count:
        await session.commit()
    return count


async def job_field_report_gap_alerts(session: AsyncSession) -> int:
    """Weekly: field agents with no report within org policy window."""
    brain = MemoryService(session)
    policy_svc = PolicyService(session)
    org_rows = (
        await session.execute(text("SELECT id FROM organizations"))
    ).mappings().all()
    count = 0
    for org in org_rows:
        org_id = str(org["id"])
        policy = await policy_svc.get_effective_policy(org_id)
        rows = (
            await session.execute(
                text(
                    "SELECT u.id, u.full_name, u.organization_id, pm.user_id AS manager_id"
                    " FROM users u"
                    " JOIN org_memberships om ON om.user_id = u.id AND om.organization_id = u.organization_id"
                    " LEFT JOIN users pm ON pm.organization_id = u.organization_id"
                    "   AND pm.id IN ("
                    "     SELECT user_id FROM org_memberships"
                    "     WHERE organization_id = u.organization_id"
                    "     AND role IN ('owner', 'admin', 'manager')"
                    "   )"
                    " WHERE u.organization_id = CAST(:oid AS uuid)"
                    " AND om.role = 'field_agent' AND u.is_active = true AND om.is_active = true"
                    " AND NOT EXISTS ("
                    "   SELECT 1 FROM documents d"
                    "   WHERE d.submitted_by = u.id AND d.doc_type = 'field_report'"
                    "   AND d.mission_date >= CURRENT_DATE - CAST(:gap AS integer) * INTERVAL '1 day'"
                    " )"
                ).bindparams(oid=org_id, gap=policy.field_report_gap_days),
            )
        ).mappings().all()

        for row in rows:
            dedup_key = f"gap:{row['id']}:{date.today().isoformat()}"
            if not await try_acquire_job_key(session, "field_report_gaps", dedup_key):
                continue
            gap_msg = f"Aucun rapport terrain cette semaine pour {row['full_name']}."
            await send_push(
                session,
                user_id=str(row["id"]),
                title="Rapport terrain manquant",
                body=gap_msg,
                data={"type": "field_report_gap"},
            )
            if row.get("manager_id"):
                await send_push(
                    session,
                    user_id=str(row["manager_id"]),
                    title="Écart rapport terrain",
                    body=gap_msg,
                    data={"type": "field_report_gap", "agent_id": str(row["id"])},
                )
            await brain.write_memory(
                org_id=org_id,
                type="episodic",
                entity_type="field_report",
                entity_id=str(row["id"]),
                note=f"Field report gap alert: no report from {row['full_name']} in {policy.field_report_gap_days} days",
                source_module="events",
                source_id=str(row["id"]),
            )
            count += 1
    if count:
        await session.commit()
    return count


async def run_event_checks(session: AsyncSession, *, include_weekly: bool = False) -> dict:
    overdue = await job_overdue_task_alerts(session)
    reminders = await job_commitment_reminders(session)
    gaps = await job_field_report_gap_alerts(session) if include_weekly else 0
    return {
        "checked_at": datetime.now(UTC).isoformat(),
        "overdue_task_alerts": overdue,
        "commitment_reminders_sent": reminders,
        "field_report_gap_alerts": gaps,
    }


async def trigger_on_task_change(session: AsyncSession, org_id: str) -> int:
    """Immediate overdue check for one org after task status change."""
    brain = MemoryService(session)
    policy = await PolicyService(session).get_effective_policy(org_id)
    rows = (
        await session.execute(
            text(
                "SELECT t.id, t.title, t.organization_id, t.assignee_id, u.full_name, u.email"
                " FROM tasks t"
                " JOIN users u ON u.id = t.assignee_id"
                " WHERE t.organization_id = CAST(:oid AS uuid)"
                " AND t.status != 'done'"
                " AND t.due_date IS NOT NULL"
                " AND t.due_date < CURRENT_DATE - CAST(:days AS integer) * INTERVAL '1 day'"
            ).bindparams(oid=org_id, days=policy.overdue_task_days),
        )
    ).mappings().all()
    count = 0
    for row in rows:
        msg = f"Rappel: la tâche « {row['title']} » est en retard."
        if row.get("email"):
            whatsapp_client.send_message(row["email"], msg)
        if row.get("assignee_id"):
            await send_push(
                session,
                user_id=str(row["assignee_id"]),
                title="Tâche en retard",
                body=msg,
                data={"type": "overdue_task", "task_id": str(row["id"])},
            )
        await brain.write_memory(
            org_id=org_id,
            type="episodic",
            entity_type="task",
            entity_id=str(row["id"]),
            note=f"Overdue task reminder sent: {row['title']} to {row['full_name']}",
            source_module="events",
            source_id=str(row["id"]),
        )
        count += 1
    if count:
        await session.commit()
    return count


async def trigger_on_meeting_processed(session: AsyncSession, org_id: str) -> int:
    """Immediate commitment reminders after meeting processing."""
    return await job_commitment_reminders(session)
