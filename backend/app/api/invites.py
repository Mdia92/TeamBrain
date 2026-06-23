"""Organization invites API — admin only."""

from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.db.session import get_db
from app.pagination import cursor_clause, paginate_response
from app.trial import require_write_access

router = APIRouter(prefix="/api/invites", tags=["invites"])


class InviteIn(BaseModel):
    email: EmailStr
    role: str = Field(default="member")


@router.get("")
async def list_invites(
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    cc, cparams = cursor_clause(cursor)
    params: dict = {"oid": str(user["organization_id"]), "lim": limit + 1, **cparams}
    rows = [
        dict(r)
        for r in (
            await session.execute(
                text(
                    "SELECT id, email, role, expires_at, created_at FROM organization_invites"
                    " WHERE organization_id = CAST(:oid AS uuid) AND accepted_at IS NULL"
                    f"{cc} ORDER BY created_at DESC, id DESC LIMIT :lim"
                ).bindparams(**params),
            )
        ).mappings().all()
    ]
    return paginate_response(rows, limit=limit, cursor_fields=["created_at", "id"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: InviteIn,
    user: dict = Depends(require_role("owner", "admin")),
    _write: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.role not in ("admin", "manager", "member", "field_agent"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rôle invalide")
    token = secrets.token_urlsafe(32)
    iid = uuid.uuid4()
    await session.execute(
        text(
            "INSERT INTO organization_invites (id, organization_id, email, role, token, expires_at, invited_by)"
            " VALUES (CAST(:iid AS uuid), CAST(:oid AS uuid), :email, :role, :token,"
            " now() + INTERVAL '7 days', CAST(:uid AS uuid))"
        ).bindparams(
            iid=str(iid),
            oid=str(user["organization_id"]),
            email=body.email,
            role=body.role,
            token=token,
            uid=str(user["id"]),
        ),
    )
    await session.commit()
    return {"id": str(iid), "email": body.email, "role": body.role, "token": token, "invite_url": f"/invite/{token}"}
