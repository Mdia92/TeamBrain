"""Organization members API — admin only."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.db.sql_compat import is_sqlite
from app.pagination import decode_cursor, paginate_response
from app.trial import require_write_access

router = APIRouter(prefix="/api/members", tags=["members"])


class RoleUpdateIn(BaseModel):
    role: str


@router.get("")
async def list_members(
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    cc, cparams = "", {}
    if cursor:
        c = decode_cursor(cursor)
        cc = " AND (om.joined_at, om.id) < (CAST(:c_at AS timestamptz), CAST(:c_id AS uuid))"
        cparams = {"c_at": c["joined_at"], "c_id": c["membership_id"]}
    params: dict = {"oid": str(user["organization_id"]), "lim": limit + 1, **cparams}
    rows = [
        dict(r)
        for r in (
            await session.execute(
                text(
                    "SELECT u.id, u.full_name, u.email, om.role, u.is_active, om.joined_at, om.id AS membership_id"
                    " FROM org_memberships om"
                    " JOIN users u ON u.id = om.user_id"
                    " WHERE om.organization_id = CAST(:oid AS uuid) AND om.is_active = true"
                    f"{cc} ORDER BY om.joined_at DESC, om.id DESC LIMIT :lim"
                ).bindparams(**params),
            )
        ).mappings().all()
    ]
    return paginate_response(rows, limit=limit, cursor_fields=["joined_at", "membership_id"])


@router.get("/roster")
async def member_roster(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Active org members for task assignment (all roles may read)."""
    oid = str(user["organization_id"])
    if is_sqlite():
        rows = [
            dict(r)
            for r in (
                await session.execute(
                    text(
                        "SELECT u.id, u.full_name, u.email, om.role"
                        " FROM org_memberships om"
                        " JOIN users u ON u.id = om.user_id"
                        " WHERE om.organization_id = :oid AND om.is_active = 1"
                        " ORDER BY u.full_name"
                    ).bindparams(oid=oid),
                )
            ).mappings().all()
        ]
    else:
        rows = [
            dict(r)
            for r in (
                await session.execute(
                    text(
                        "SELECT u.id, u.full_name, u.email, om.role"
                        " FROM org_memberships om"
                        " JOIN users u ON u.id = om.user_id"
                        " WHERE om.organization_id = CAST(:oid AS uuid) AND om.is_active = true"
                        " ORDER BY u.full_name"
                    ).bindparams(oid=oid),
                )
            ).mappings().all()
        ]
    for row in rows:
        row["id"] = str(row["id"])
    return {"items": rows}


@router.patch("/{member_id}/role")
async def update_member_role(
    member_id: str,
    body: RoleUpdateIn,
    user: dict = Depends(require_role("owner", "admin")),
    _write: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.role not in ("admin", "manager", "member", "field_agent"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rôle invalide")
    if member_id == str(user["id"]) and body.role != user["role"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vous ne pouvez pas modifier votre propre rôle")
    result = await session.execute(
        text(
            "UPDATE org_memberships SET role = :role"
            " WHERE user_id = CAST(:mid AS uuid)"
            " AND organization_id = CAST(:oid AS uuid) RETURNING user_id"
        ).bindparams(role=body.role, mid=member_id, oid=str(user["organization_id"])),
    )
    if not result.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membre introuvable")
    await session.commit()
    return {"id": member_id, "role": body.role}
