"""Event-driven closed loops — rules-first with Team Brain memory writes."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.delivery.push import send_push
from app.delivery.whatsapp import whatsapp_client
from app.job_dedup import try_acquire_job_key


async def job_overdue_task_alerts(session: AsyncSession) -> int:
    brain = MemoryService(session)
    rows = (
        await session.execute(
            text(
                "SELECT t.id, t.title, t.due_date, t.organization_id, t.assignee_id,"
                " u.full_name, u.email"
                " FROM tasks t"
                " JOIN users u ON u.id = t.assignee_id"
                " WHERE t.status != 'done'"
                " AND t.due_date < CURRENT_DATE - INTERVAL '2 days'"
            ),
        )
    ).mappings().all()

    count = 0
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
            org_id=str(row["organization_id"]),
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
    rows = (
        await session.execute(
            text(
                "SELECT mc.id, mc.commitment_text, mc.deadline, mc.meeting_id, mc.committed_by,"
                " m.organization_id, u.full_name, u.email"
                " FROM meeting_commitments mc"
                " JOIN meetings m ON m.id = mc.meeting_id"
                " LEFT JOIN users u ON u.id = mc.committed_by"
                " WHERE mc.is_fulfilled = false AND mc.reminder_sent = false"
                " AND mc.deadline <= CURRENT_DATE + INTERVAL '1 day'"
            ),
        )
    ).mappings().all()

    count = 0
    for row in rows:
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
            org_id=str(row["organization_id"]),
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
    """Weekly: field agents with no report in last 7 days."""
    brain = MemoryService(session)
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
                " WHERE om.role = 'field_agent' AND u.is_active = true AND om.is_active = true"
                " AND NOT EXISTS ("
                "   SELECT 1 FROM field_reports fr"
                "   WHERE fr.submitted_by = u.id"
                "   AND fr.mission_date >= CURRENT_DATE - INTERVAL '7 days'"
                " )"
            ),
        )
    ).mappings().all()

    count = 0
    seen_orgs: set[str] = set()
    for row in rows:
        dedup_key = f"gap:{row['id']}:{date.today().isoformat()}"
        if not await try_acquire_job_key(session, "field_report_gaps", dedup_key):
            continue
        oid = str(row["organization_id"])
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
            org_id=oid,
            type="episodic",
            entity_type="field_report",
            entity_id=str(row["id"]),
            note=f"Field report gap alert: no report from {row['full_name']} this week",
            source_module="events",
            source_id=str(row["id"]),
        )
        seen_orgs.add(oid)
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
    rows = (
        await session.execute(
            text(
                "SELECT t.id, t.title, t.organization_id, t.assignee_id, u.full_name, u.email"
                " FROM tasks t"
                " JOIN users u ON u.id = t.assignee_id"
                " WHERE t.organization_id = CAST(:oid AS uuid)"
                " AND t.status != 'done'"
                " AND t.due_date < CURRENT_DATE - INTERVAL '2 days'"
            ).bindparams(oid=org_id),
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
