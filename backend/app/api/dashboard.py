"""Dashboard KPIs, charts, and activity feeds."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.services.dashboard_stats import (
    get_activity_chart,
    get_member_contributions,
    get_recent_activity,
    get_stats,
)
from app.services.pending_actions import count_pending_actions, list_pending_actions

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

ADMIN_ROLES = frozenset({"owner", "admin"})


def _is_admin(user: dict) -> bool:
    return user.get("role") in ADMIN_ROLES


async def _org_settings(session: AsyncSession, oid: str) -> dict:
    row = (
        await session.execute(
            text("SELECT settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(oid=oid),
        )
    ).mappings().first()
    settings = row["settings"] if row else {}
    return settings if isinstance(settings, dict) else {}


@router.get("/stats")
async def dashboard_stats(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    settings = await _org_settings(session, oid)
    return {
        "stats": await get_stats(session, oid),
        "team_size": settings.get("team_size", "1-10"),
    }


@router.get("/activity-chart")
async def dashboard_activity_chart(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    return {"items": await get_activity_chart(session, oid)}


@router.get("/member-contributions")
async def dashboard_member_contributions(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    return {"items": await get_member_contributions(session, oid)}


@router.get("/recent-activity")
async def dashboard_recent_activity(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    return {"items": await get_recent_activity(session, oid)}


@router.get("")
async def dashboard(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    week_ago = (datetime.now(UTC) - timedelta(days=7)).date()
    settings = await _org_settings(session, oid)
    checklist = settings.get("setup_checklist", {})

    active_projects = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM projects WHERE organization_id = CAST(:oid AS uuid)"
                " AND status = 'active'"
            ).bindparams(oid=oid),
        )
    ).scalar() or 0

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

    pending_items = await list_pending_actions(session, oid)
    if not _is_admin(user):
        pending_items = []

    return {
        "kpis": (await get_stats(session, oid)),
        "team_size": settings.get("team_size", "1-10"),
        "setup_checklist": setup_checklist,
        "pending_actions": pending_items[:5],
        "pending_actions_count": await count_pending_actions(session, oid),
        "can_approve_pending": _is_admin(user),
        "generated_at": datetime.now(UTC).isoformat(),
        "stats_legacy": {
            "tasks_completed_week": (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM tasks WHERE organization_id = CAST(:oid AS uuid)"
                        " AND status = 'done' AND updated_at >= :week"
                    ).bindparams(oid=oid, week=week_ago),
                )
            ).scalar()
            or 0,
            "active_projects": active_projects,
        },
    }
