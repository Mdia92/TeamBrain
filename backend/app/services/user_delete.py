"""Remove a member from an org; delete the user row when they have no other memberships."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.sql_compat import is_sqlite


async def _other_active_memberships(session: AsyncSession, *, user_id: str, org_id: str) -> int:
    if is_sqlite():
        row = (
            await session.execute(
                text(
                    "SELECT COUNT(*) FROM org_memberships"
                    " WHERE user_id = :uid AND organization_id != :oid AND is_active = 1"
                ).bindparams(uid=user_id, oid=org_id),
            )
        ).scalar()
        return int(row or 0)
    row = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM org_memberships"
                " WHERE user_id = CAST(:uid AS uuid)"
                " AND organization_id != CAST(:oid AS uuid) AND is_active = true"
            ).bindparams(uid=user_id, oid=org_id),
        )
    ).scalar()
    return int(row or 0)


async def remove_org_member(
    session: AsyncSession,
    *,
    org_id: str,
    user_id: str,
) -> bool:
    """Remove member from org; delete user account if no other orgs. Returns False if not a member."""
    if is_sqlite():
        exists = (
            await session.execute(
                text(
                    "SELECT 1 FROM org_memberships"
                    " WHERE user_id = :uid AND organization_id = :oid AND is_active = 1"
                ).bindparams(uid=user_id, oid=org_id),
            )
        ).first()
        if not exists:
            return False
        await session.execute(
            text("DELETE FROM org_memberships WHERE user_id = :uid AND organization_id = :oid").bindparams(
                uid=user_id, oid=org_id,
            ),
        )
        others = await _other_active_memberships(session, user_id=user_id, org_id=org_id)
        if others == 0:
            await session.execute(
                text("DELETE FROM refresh_tokens WHERE user_id = :uid").bindparams(uid=user_id),
            )
            await session.execute(text("DELETE FROM users WHERE id = :uid").bindparams(uid=user_id))
        return True

    exists = (
        await session.execute(
            text(
                "SELECT 1 FROM org_memberships"
                " WHERE user_id = CAST(:uid AS uuid)"
                " AND organization_id = CAST(:oid AS uuid) AND is_active = true"
            ).bindparams(uid=user_id, oid=org_id),
        )
    ).first()
    if not exists:
        return False

    params = {"uid": user_id, "oid": org_id}

    await session.execute(
        text(
            "UPDATE tasks SET assignee_id = NULL"
            " WHERE organization_id = CAST(:oid AS uuid) AND assignee_id = CAST(:uid AS uuid)"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM org_notifications"
            " WHERE organization_id = CAST(:oid AS uuid) AND user_id = CAST(:uid AS uuid)"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM daily_status"
            " WHERE organization_id = CAST(:oid AS uuid) AND user_id = CAST(:uid AS uuid)"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM event_attendees"
            " WHERE user_id = CAST(:uid AS uuid)"
            " AND event_id IN (SELECT id FROM events WHERE organization_id = CAST(:oid AS uuid))"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM project_members"
            " WHERE user_id = CAST(:uid AS uuid)"
            " AND project_id IN (SELECT id FROM projects WHERE organization_id = CAST(:oid AS uuid))"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM channel_members"
            " WHERE user_id = CAST(:uid AS uuid)"
            " AND channel_id IN (SELECT id FROM channels WHERE organization_id = CAST(:oid AS uuid))"
        ).bindparams(**params),
    )
    await session.execute(
        text(
            "DELETE FROM org_memberships"
            " WHERE user_id = CAST(:uid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(**params),
    )

    others = await _other_active_memberships(session, user_id=user_id, org_id=org_id)
    if others == 0:
        await session.execute(
            text("DELETE FROM refresh_tokens WHERE user_id = CAST(:uid AS uuid)").bindparams(uid=user_id),
        )
        await session.execute(
            text("DELETE FROM device_tokens WHERE user_id = CAST(:uid AS uuid)").bindparams(uid=user_id),
        )
        await session.execute(
            text("DELETE FROM users WHERE id = CAST(:uid AS uuid)").bindparams(uid=user_id),
        )

    return True
