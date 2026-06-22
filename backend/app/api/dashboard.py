"""Dashboard KPIs and overview."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db

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
                "SELECT COUNT(*) FROM field_reports WHERE organization_id = CAST(:oid AS uuid)"
                " AND mission_date >= :week"
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
                "SELECT id, location_name, mission_date::text, ai_summary FROM field_reports"
                " WHERE organization_id = CAST(:oid AS uuid) ORDER BY created_at DESC LIMIT 5"
            ).bindparams(oid=oid),
        )
    ).mappings().all()

    return {
        "kpis": {
            "active_projects": active_projects,
            "tasks_completed_week": tasks_done_week,
            "overdue_tasks": overdue_tasks,
            "field_reports_week": field_reports_week,
        },
        "upcoming_deadlines": [dict(r) for r in upcoming],
        "recent_field_reports": [dict(r) for r in recent_reports],
        "generated_at": datetime.now(UTC).isoformat(),
    }
