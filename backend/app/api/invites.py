"""Organization invites API — admin only."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.config import settings
from app.db.session import get_db
from app.pagination import cursor_clause, paginate_response
from app.services.invite_delivery import deliver_organization_invite
from app.services.invites import email_is_active_member, insert_organization_invite
from app.trial import require_write_access

router = APIRouter(prefix="/api/invites", tags=["invites"])


class InviteIn(BaseModel):
    email: EmailStr
    role: str = Field(default="member")


async def _assert_can_invite(
    session: AsyncSession,
    *,
    org_id: str,
    email: str,
    inviter_email: str | None,
) -> None:
    if inviter_email and email.lower() == inviter_email.lower():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Vous êtes déjà membre — inutile de vous inviter vous-même.",
        )
    if await email_is_active_member(session, org_id=org_id, email=email):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Cette personne est déjà membre actif de l'équipe.",
        )
    dup = (
        await session.execute(
            text(
                "SELECT 1 FROM organization_invites"
                " WHERE organization_id = CAST(:oid AS uuid) AND lower(email) = lower(:email)"
                " AND accepted_at IS NULL AND expires_at > now()"
            ).bindparams(oid=org_id, email=email),
        )
    ).first()
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "Une invitation est déjà en attente pour cet email")


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
                    "SELECT id, email, role, short_code, token, expires_at, created_at, accepted_at"
                    " FROM organization_invites"
                    " WHERE organization_id = CAST(:oid AS uuid) AND accepted_at IS NULL"
                    f"{cc} ORDER BY created_at DESC, id DESC LIMIT :lim"
                ).bindparams(**params),
            )
        ).mappings().all()
    ]
    front = settings.frontend_url.rstrip("/")
    for row in rows:
        row["status"] = "pending"
        row["invite_url"] = f"{front}/invite/{row.get('token', '')}" if row.get("token") else None
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

    org_id = str(user["organization_id"])
    await _assert_can_invite(session, org_id=org_id, email=body.email, inviter_email=user.get("email"))

    created = await insert_organization_invite(
        session,
        org_id=org_id,
        email=body.email,
        role=body.role,
        invited_by=str(user["id"]),
    )
    await session.commit()

    delivery = await deliver_organization_invite(
        session,
        org_id=org_id,
        invite=created,
        email=body.email,
        role=body.role,
        inviter_id=str(user["id"]),
    )

    return {
        "id": created["id"],
        "email": body.email,
        "role": body.role,
        "status": "pending",
        "token": created["token"],
        "short_code": created["short_code"],
        "invite_url": created["invite_url"],
        "full_invite_url": delivery.get("invite_url"),
        "email_sent": delivery.get("email_sent"),
    }


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    invite_id: str,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> None:
    result = await session.execute(
        text(
            "DELETE FROM organization_invites"
            " WHERE id = CAST(:iid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            " AND accepted_at IS NULL"
        ).bindparams(iid=invite_id, oid=str(user["organization_id"])),
    )
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation introuvable ou déjà acceptée")
    await session.commit()


@router.post("/{invite_id}/resend")
async def resend_invite(
    invite_id: str,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    row = (
        await session.execute(
            text(
                "SELECT id, email, role, token, short_code FROM organization_invites"
                " WHERE id = CAST(:iid AS uuid) AND organization_id = CAST(:oid AS uuid)"
                " AND accepted_at IS NULL AND expires_at > now()"
            ).bindparams(iid=invite_id, oid=str(user["organization_id"])),
        )
    ).mappings().first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation introuvable ou expirée")

    invite = {
        "id": str(row["id"]),
        "token": row["token"],
        "short_code": row["short_code"],
        "invite_url": f"/invite/{row['token']}",
    }
    delivery = await deliver_organization_invite(
        session,
        org_id=str(user["organization_id"]),
        invite=invite,
        email=row["email"],
        role=row["role"],
        inviter_id=str(user["id"]),
    )
    return {
        "status": "resent",
        "email": row["email"],
        "email_sent": delivery.get("email_sent"),
        "full_invite_url": delivery.get("invite_url"),
        "short_code": row["short_code"],
    }
