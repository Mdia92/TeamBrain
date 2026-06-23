"""Dashboard KPIs and overview."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.services.pending_actions import count_pending_actions

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def dashboard(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    week_ago = (datetime.now(UTC) - timedelta(days=7)).date()

    active_projects = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM projects WHERE organization_id = CAST(:oid AS uuid)"
                " AND status = 'active'"
            ).bindparams(oid=oid),
        )
    ).scalar() or 0

    tasks_done_week = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM tasks WHERE organization_id = CAST(:oid AS uuid)"
                " AND status = 'done' AND created_at >= :week"
            ).bindparams(oid=oid, week=week_ago),
        )
    ).scalar() or 0

    overdue_tasks = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM tasks WHERE organization_id = CAST(:oid AS uuid)"
                " AND status != 'done' AND due_date < CURRENT_DATE"
            ).bindparams(oid=oid),
        )
    ).scalar() or 0

    field_reports_week = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM documents WHERE organization_id = CAST(:oid AS uuid)"
                " AND doc_type = 'field_report' AND mission_date >= :week"
            ).bindparams(oid=oid, week=week_ago),
        )
    ).scalar() or 0

    upcoming = (
        await session.execute(
            text(
                "SELECT id, title, due_date::text, priority, status FROM tasks"
                " WHERE organization_id = CAST(:oid AS uuid) AND status != 'done'"
                " AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'"
                " ORDER BY due_date LIMIT 10"
            ).bindparams(oid=oid),
        )
    ).mappings().all()

    recent_reports = (
        await session.execute(
            text(
                "SELECT id, location_name, mission_date::text, ai_summary FROM documents"
                " WHERE organization_id = CAST(:oid AS uuid) AND doc_type = 'field_report'"
                " ORDER BY created_at DESC LIMIT 5"
            ).bindparams(oid=oid),
        )
    ).mappings().all()

    org_settings = (
        await session.execute(
            text("SELECT settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(oid=oid),
        )
    ).mappings().first()
    settings = org_settings["settings"] if org_settings else {}
    checklist = settings.get("setup_checklist", {}) if isinstance(settings, dict) else {}

    project_count = (
        await session.execute(
            text("SELECT COUNT(*) FROM projects WHERE organization_id = CAST(:oid AS uuid)").bindparams(oid=oid),
        )
    ).scalar() or 0
    report_count = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM documents WHERE organization_id = CAST(:oid AS uuid)"
                " AND doc_type = 'field_report'"
            ).bindparams(oid=oid),
        )
    ).scalar() or 0
    meeting_count = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM meetings WHERE organization_id = CAST(:oid AS uuid)"
                " AND ai_summary IS NOT NULL"
            ).bindparams(oid=oid),
        )
    ).scalar() or 0

    setup_checklist = {
        "profile_completed": checklist.get("profile_completed", True),
        "team_invited": checklist.get("team_invited", False),
        "first_project": project_count > 0,
        "first_field_report": report_count > 0,
        "first_meeting": meeting_count > 0,
    }

    return {
        "kpis": {
            "active_projects": active_projects,
            "tasks_completed_week": tasks_done_week,
            "overdue_tasks": overdue_tasks,
            "field_reports_week": field_reports_week,
        },
        "upcoming_deadlines": [dict(r) for r in upcoming],
        "recent_field_reports": [dict(r) for r in recent_reports],
        "setup_checklist": setup_checklist,
        "pending_actions_count": await count_pending_actions(session, oid),
        "generated_at": datetime.now(UTC).isoformat(),
    }
