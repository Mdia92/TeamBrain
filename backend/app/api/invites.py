"""Organization invites API — admin only."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.config import settings
from app.db.session import get_db
from app.delivery.email import notify_admin
from app.pagination import cursor_clause, paginate_response
from app.services.invites import insert_organization_invite
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
                    "SELECT id, email, role, short_code, expires_at, created_at FROM organization_invites"
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

    dup = (
        await session.execute(
            text(
                "SELECT 1 FROM organization_invites"
                " WHERE organization_id = CAST(:oid AS uuid) AND lower(email) = lower(:email)"
                " AND accepted_at IS NULL AND expires_at > now()"
            ).bindparams(oid=str(user["organization_id"]), email=body.email),
        )
    ).first()
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "Une invitation est déjà en attente pour cet email")

    created = await insert_organization_invite(
        session,
        org_id=str(user["organization_id"]),
        email=body.email,
        role=body.role,
        invited_by=str(user["id"]),
    )
    await session.commit()

    front = settings.frontend_url.rstrip("/")
    invite_url = f"{front}{created['invite_url']}"
    await notify_admin(
        event="team_invite",
        subject="Invitation équipe créée",
        body=(
            f"Organisation ID : {user['organization_id']}\n"
            f"Invité par : {user.get('full_name')} <{user.get('email')}>\n"
            f"Email invité : {body.email}\n"
            f"Rôle : {body.role}\n"
            f"Code : {created['short_code']}\n"
            f"Lien : {invite_url}"
        ),
    )

    return {
        "id": created["id"],
        "email": body.email,
        "role": body.role,
        "token": created["token"],
        "short_code": created["short_code"],
        "invite_url": created["invite_url"],
    }
