"""Org membership helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_membership(
    session: AsyncSession, user_id: str, org_id: str
) -> dict | None:
    row = (
        await session.execute(
            text(
                "SELECT om.role, om.is_active, o.slug, o.name"
                " FROM org_memberships om"
                " JOIN organizations o ON o.id = om.organization_id"
                " WHERE om.user_id = CAST(:uid AS uuid)"
                " AND om.organization_id = CAST(:oid AS uuid)"
            ).bindparams(uid=user_id, oid=org_id),
        )
    ).mappings().first()
    return dict(row) if row else None


async def list_user_orgs(session: AsyncSession, user_id: str) -> list[dict]:
    rows = (
        await session.execute(
            text(
                "SELECT o.id, o.name, o.slug, om.role, om.joined_at"
                " FROM org_memberships om"
                " JOIN organizations o ON o.id = om.organization_id"
                " WHERE om.user_id = CAST(:uid AS uuid) AND om.is_active = true"
                " ORDER BY om.joined_at ASC"
            ).bindparams(uid=user_id),
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def create_membership(
    session: AsyncSession,
    *,
    user_id: str,
    org_id: str,
    role: str,
) -> None:
    await session.execute(
        text(
            "INSERT INTO org_memberships (id, user_id, organization_id, role)"
            " VALUES (CAST(:id AS uuid), CAST(:uid AS uuid), CAST(:oid AS uuid), :role)"
            " ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true"
        ).bindparams(id=str(uuid.uuid4()), uid=user_id, oid=org_id, role=role),
    )


async def get_role_for_org(session: AsyncSession, user_id: str, org_id: str) -> str | None:
    m = await get_membership(session, user_id, org_id)
    if m and m.get("is_active"):
        return m["role"]
    return None
