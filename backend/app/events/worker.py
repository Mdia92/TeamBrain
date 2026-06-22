"""Event-driven closed loops — rules-first with Team Brain memory writes."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.delivery.whatsapp import whatsapp_client


async def job_overdue_task_alerts(session: AsyncSession) -> int:
    brain = MemoryService(session)
    rows = (
        await session.execute(
            text(
                "SELECT t.id, t.title, t.organization_id, u.full_name, u.email"
                " FROM tasks t"
                " JOIN users u ON u.id = t.assignee_id"
                " WHERE t.status != 'done'"
                " AND t.due_date < CURRENT_DATE - INTERVAL '2 days'"
            ),
        )
    ).mappings().all()

    count = 0
    for row in rows:
        msg = f"Rappel: la tâche « {row['title']} » est en retard."
        if row.get("email"):
            whatsapp_client.send_message(row["email"], msg)
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
                "SELECT mc.id, mc.commitment_text, mc.deadline, mc.meeting_id,"
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
                " LEFT JOIN users pm ON pm.organization_id = u.organization_id"
                "   AND pm.role IN ('owner', 'admin', 'manager')"
                " WHERE u.role = 'field_agent' AND u.is_active = true"
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
        oid = str(row["organization_id"])
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
