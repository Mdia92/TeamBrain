"""Dashboard aggregation queries."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def _scalar(session: AsyncSession, sql: str, **params) -> int:
    return int((await session.execute(text(sql).bindparams(**params))).scalar() or 0)


async def get_stats(session: AsyncSession, oid: str) -> dict:
    now = datetime.now(UTC)
    week_start = (now - timedelta(days=7)).date()
    prev_week_start = (now - timedelta(days=14)).date()
    month_start = now.replace(day=1).date()
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    tasks_week = await _scalar(
        session,
        "SELECT COUNT(*) FROM tasks WHERE organization_id = CAST(:oid AS uuid)"
        " AND status = 'done' AND updated_at >= :start",
        oid=oid,
        start=week_start,
    )
    tasks_prev_week = await _scalar(
        session,
        "SELECT COUNT(*) FROM tasks WHERE organization_id = CAST(:oid AS uuid)"
        " AND status = 'done' AND updated_at >= :start AND updated_at < :end",
        oid=oid,
        start=prev_week_start,
        end=week_start,
    )
    tasks_pct = _pct_change(tasks_week, tasks_prev_week)

    active_projects = await _scalar(
        session,
        "SELECT COUNT(*) FROM projects WHERE organization_id = CAST(:oid AS uuid) AND status = 'active'",
        oid=oid,
    )

    docs_month = await _scalar(
        session,
        "SELECT COUNT(*) FROM documents WHERE organization_id = CAST(:oid AS uuid)"
        " AND created_at >= :start",
        oid=oid,
        start=month_start,
    )
    docs_prev_month = await _scalar(
        session,
        "SELECT COUNT(*) FROM documents WHERE organization_id = CAST(:oid AS uuid)"
        " AND created_at >= :start AND created_at < :end",
        oid=oid,
        start=prev_month_start,
        end=month_start,
    )
    docs_pct = _pct_change(docs_month, docs_prev_month)

    memory_count = await _scalar(
        session,
        "SELECT COUNT(*) FROM memory_metadata WHERE organization_id = CAST(:oid AS uuid)",
        oid=oid,
    )
    memory_prev = await _scalar(
        session,
        "SELECT COUNT(*) FROM memory_metadata WHERE organization_id = CAST(:oid AS uuid)"
        " AND created_at < :start",
        oid=oid,
        start=month_start,
    )
    memory_growth = memory_count - memory_prev

    return {
        "tasks_completed_week": tasks_week,
        "tasks_completed_week_change_pct": tasks_pct,
        "active_projects": active_projects,
        "documents_month": docs_month,
        "documents_month_change_pct": docs_pct,
        "memory_count": memory_count,
        "memory_growth_month": memory_growth,
    }


def _pct_change(current: int, previous: int) -> float | None:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


async def get_activity_chart(session: AsyncSession, oid: str, days: int = 30) -> list[dict]:
    start = (datetime.now(UTC) - timedelta(days=days - 1)).date()
    rows = (
        await session.execute(
            text(
                """
                WITH days AS (
                    SELECT generate_series(CAST(:start AS date), CURRENT_DATE, '1 day'::interval)::date AS day
                ),
                task_actions AS (
                    SELECT updated_at::date AS day, COUNT(*) AS cnt
                    FROM tasks
                    WHERE organization_id = CAST(:oid AS uuid)
                      AND status = 'done' AND updated_at::date >= :start
                    GROUP BY 1
                ),
                doc_actions AS (
                    SELECT created_at::date AS day, COUNT(*) AS cnt
                    FROM documents
                    WHERE organization_id = CAST(:oid AS uuid) AND created_at::date >= :start
                    GROUP BY 1
                ),
                msg_actions AS (
                    SELECT created_at::date AS day, COUNT(*) AS cnt
                    FROM messages
                    WHERE organization_id = CAST(:oid AS uuid) AND created_at::date >= :start
                    GROUP BY 1
                )
                SELECT d.day::text AS date,
                    COALESCE(t.cnt, 0) + COALESCE(doc.cnt, 0) + COALESCE(m.cnt, 0) AS actions
                FROM days d
                LEFT JOIN task_actions t ON t.day = d.day
                LEFT JOIN doc_actions doc ON doc.day = d.day
                LEFT JOIN msg_actions m ON m.day = d.day
                ORDER BY d.day
                """
            ).bindparams(oid=oid, start=start),
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def get_member_contributions(session: AsyncSession, oid: str, limit: int = 5) -> list[dict]:
    month_start = datetime.now(UTC).replace(day=1).date()
    rows = (
        await session.execute(
            text(
                """
                WITH actions AS (
                    SELECT assignee_id AS user_id FROM tasks
                    WHERE organization_id = CAST(:oid AS uuid) AND status = 'done'
                      AND updated_at::date >= :month
                    UNION ALL
                    SELECT submitted_by FROM documents
                    WHERE organization_id = CAST(:oid AS uuid) AND submitted_by IS NOT NULL
                      AND created_at::date >= :month
                    UNION ALL
                    SELECT sender_id FROM messages
                    WHERE organization_id = CAST(:oid AS uuid) AND created_at::date >= :month
                )
                SELECT u.id, u.full_name, COUNT(*)::int AS actions
                FROM actions a
                JOIN users u ON u.id = a.user_id
                GROUP BY u.id, u.full_name
                ORDER BY actions DESC
                LIMIT :lim
                """
            ).bindparams(oid=oid, month=month_start, lim=limit),
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def get_recent_activity(session: AsyncSession, oid: str, limit: int = 15) -> list[dict]:
    rows = (
        await session.execute(
            text(
                """
                (
                    SELECT 'task' AS type, t.id::text, t.title AS label,
                        u.full_name AS actor_name, u.id::text AS actor_id,
                        t.updated_at AS at
                    FROM tasks t
                    LEFT JOIN users u ON u.id = t.assignee_id
                    WHERE t.organization_id = CAST(:oid AS uuid) AND t.status = 'done'
                )
                UNION ALL
                (
                    SELECT 'document', d.id::text,
                        COALESCE(d.title, d.location_name, 'Document'),
                        u.full_name, u.id::text, d.created_at
                    FROM documents d
                    LEFT JOIN users u ON u.id = d.submitted_by
                    WHERE d.organization_id = CAST(:oid AS uuid)
                )
                UNION ALL
                (
                    SELECT 'message', m.id::text,
                        COALESCE(m.subject, LEFT(m.content, 60)),
                        u.full_name, u.id::text, m.created_at
                    FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.organization_id = CAST(:oid AS uuid) AND m.channel_id IS NULL
                )
                UNION ALL
                (
                    SELECT 'meeting', mt.id::text, mt.title,
                        u.full_name, u.id::text, mt.created_at
                    FROM meetings mt
                    LEFT JOIN users u ON u.id = mt.created_by
                    WHERE mt.organization_id = CAST(:oid AS uuid)
                )
                ORDER BY at DESC
                LIMIT :lim
                """
            ).bindparams(oid=oid, lim=limit),
        )
    ).mappings().all()
    items = []
    for r in rows:
        item = dict(r)
        item["at"] = item["at"].isoformat() if item["at"] else None
        item["href_type"] = item["type"]
        items.append(item)
    return items
