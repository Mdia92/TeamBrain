"""Team invite helpers — short codes and row creation."""

from __future__ import annotations

import secrets
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.sql_compat import is_sqlite


async def generate_unique_short_code(session: AsyncSession) -> str:
    for _ in range(12):
        code = f"TB-{secrets.token_hex(3).upper()}"
        if is_sqlite():
            row = (
                await session.execute(
                    text("SELECT 1 FROM organization_invites WHERE short_code = :c").bindparams(c=code),
                )
            ).first()
        else:
            row = (
                await session.execute(
                    text("SELECT 1 FROM organization_invites WHERE short_code = :c").bindparams(c=code),
                )
            ).first()
        if not row:
            return code
    raise RuntimeError("Impossible de générer un code d'invitation unique")


async def insert_organization_invite(
    session: AsyncSession,
    *,
    org_id: str,
    email: str,
    role: str,
    invited_by: str,
) -> dict[str, str]:
    token = secrets.token_urlsafe(32)
    short_code = await generate_unique_short_code(session)
    iid = str(uuid.uuid4())

    if is_sqlite():
        await session.execute(
            text(
                "INSERT INTO organization_invites"
                " (id, organization_id, email, role, token, short_code, expires_at, invited_by)"
                " VALUES (:iid, :oid, :email, :role, :token, :code, datetime('now', '+7 days'), :uid)"
            ).bindparams(
                iid=iid,
                oid=org_id,
                email=email,
                role=role,
                token=token,
                code=short_code,
                uid=invited_by,
            ),
        )
    else:
        await session.execute(
            text(
                "INSERT INTO organization_invites"
                " (id, organization_id, email, role, token, short_code, expires_at, invited_by)"
                " VALUES (CAST(:iid AS uuid), CAST(:oid AS uuid), :email, :role, :token, :code,"
                " now() + INTERVAL '7 days', CAST(:uid AS uuid))"
            ).bindparams(
                iid=iid,
                oid=org_id,
                email=email,
                role=role,
                token=token,
                code=short_code,
                uid=invited_by,
            ),
        )

    return {
        "id": iid,
        "token": token,
        "short_code": short_code,
        "invite_url": f"/invite/{token}",
    }
