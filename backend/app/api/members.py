"""Organization members API — admin only."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.db.session import get_db

router = APIRouter(prefix="/api/members", tags=["members"])


class RoleUpdateIn(BaseModel):
    role: str


@router.get("")
async def list_members(
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT u.id, u.full_name, u.email, om.role, u.is_active, om.joined_at"
                " FROM org_memberships om"
                " JOIN users u ON u.id = om.user_id"
                " WHERE om.organization_id = CAST(:oid AS uuid) AND om.is_active = true"
                " ORDER BY u.full_name"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.patch("/{member_id}/role")
async def update_member_role(
    member_id: str,
    body: RoleUpdateIn,
    user: dict = Depends(require_role("owner", "admin")),
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
