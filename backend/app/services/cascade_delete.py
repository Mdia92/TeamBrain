"""Delete projects and meetings with dependent rows (FK-safe)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.sql_compat import is_sqlite


async def delete_project_cascade(
    session: AsyncSession,
    *,
    org_id: str,
    project_id: str,
) -> bool:
    """Remove a project and dependent rows. Returns False if project not found."""
    if is_sqlite():
        exists = (
            await session.execute(
                text(
                    "SELECT 1 FROM projects WHERE id = :pid AND organization_id = :oid"
                ).bindparams(pid=project_id, oid=org_id),
            )
        ).first()
        if not exists:
            return False
        await session.execute(
            text("DELETE FROM tasks WHERE project_id = :pid AND organization_id = :oid").bindparams(
                pid=project_id, oid=org_id,
            ),
        )
        result = await session.execute(
            text(
                "DELETE FROM projects WHERE id = :pid AND organization_id = :oid RETURNING id"
            ).bindparams(pid=project_id, oid=org_id),
        )
        return result.first() is not None

    exists = (
        await session.execute(
            text(
                "SELECT 1 FROM projects WHERE id = CAST(:pid AS uuid)"
                " AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(pid=project_id, oid=org_id),
        )
    ).first()
    if not exists:
        return False

    params = {"pid": project_id, "oid": org_id}

    await session.execute(
        text(
            "DELETE FROM task_dependencies"
            " WHERE organization_id = CAST(:oid AS uuid)"
            " AND (task_id IN (SELECT id FROM tasks WHERE project_id = CAST(:pid AS uuid))"
            " OR depends_on_task_id IN (SELECT id FROM tasks WHERE project_id = CAST(:pid AS uuid)))"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM meeting_action_items"
            " WHERE task_id IN (SELECT id FROM tasks WHERE project_id = CAST(:pid AS uuid))"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM tasks WHERE project_id = CAST(:pid AS uuid)"
            " AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM messages WHERE channel_id IN"
            " (SELECT id FROM channels WHERE project_id = CAST(:pid AS uuid))"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM channel_members WHERE channel_id IN"
            " (SELECT id FROM channels WHERE project_id = CAST(:pid AS uuid))"
        ).bindparams(**params),
    )
    await session.execute(
        text("DELETE FROM channels WHERE project_id = CAST(:pid AS uuid)").bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM event_attendees WHERE event_id IN"
            " (SELECT id FROM events WHERE project_id = CAST(:pid AS uuid))"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM events WHERE project_id = CAST(:pid AS uuid)"
            " AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(**params),
    )
    await session.execute(
        text("DELETE FROM milestones WHERE project_id = CAST(:pid AS uuid)").bindparams(**params),
    )
    await session.execute(
        text("DELETE FROM project_members WHERE project_id = CAST(:pid AS uuid)").bindparams(**params),
    )
    await session.execute(
        text(
            "UPDATE documents SET project_id = NULL"
            " WHERE project_id = CAST(:pid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "UPDATE meetings SET project_id = NULL"
            " WHERE project_id = CAST(:pid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(**params),
    )

    result = await session.execute(
        text(
            "DELETE FROM projects WHERE id = CAST(:pid AS uuid)"
            " AND organization_id = CAST(:oid AS uuid) RETURNING id"
        ).bindparams(**params),
    )
    return result.first() is not None


async def delete_meeting_cascade(
    session: AsyncSession,
    *,
    org_id: str,
    meeting_id: str,
) -> str | None:
    """Delete meeting and children. Returns meeting title or None if not found."""
    if is_sqlite():
        row = (
            await session.execute(
                text("SELECT title FROM meetings WHERE id = :mid AND organization_id = :oid").bindparams(
                    mid=meeting_id, oid=org_id,
                ),
            )
        ).first()
        if not row:
            return None
        await session.execute(
            text("DELETE FROM meetings WHERE id = :mid AND organization_id = :oid").bindparams(
                mid=meeting_id, oid=org_id,
            ),
        )
        return row[0]

    row = (
        await session.execute(
            text(
                "SELECT title FROM meetings WHERE id = CAST(:mid AS uuid)"
                " AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(mid=meeting_id, oid=org_id),
        )
    ).first()
    if not row:
        return None
    title = row[0]

    await session.execute(
        text("DELETE FROM meeting_decisions WHERE meeting_id = CAST(:mid AS uuid)").bindparams(
            mid=meeting_id,
        ),
    )
    await session.execute(
        text("DELETE FROM meeting_action_items WHERE meeting_id = CAST(:mid AS uuid)").bindparams(
            mid=meeting_id,
        ),
    )
    await session.execute(
        text("DELETE FROM meeting_commitments WHERE meeting_id = CAST(:mid AS uuid)").bindparams(
            mid=meeting_id,
        ),
    )
    await session.execute(
        text(
            "DELETE FROM meetings WHERE id = CAST(:mid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(mid=meeting_id, oid=org_id),
    )
    return title
