"""Auth dependencies — multi-tenant RLS context with multi-org memberships."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.auth.membership import get_membership
from app.config import settings
from app.db.session import get_db

_bearer = HTTPBearer(auto_error=False)


async def _set_rls_context(session: AsyncSession, user_id: str, org_id: str) -> None:
    await session.execute(text(f"SET LOCAL ROLE {settings.app_db_role}"))
    await session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)").bindparams(uid=user_id),
    )
    await session.execute(
        text("SELECT set_config('app.current_org_id', :oid, true)").bindparams(oid=org_id),
    )


async def reset_rls_bootstrap(session: AsyncSession) -> None:
    """Drop coord_app context so bootstrap writes (new org) bypass tenant RLS."""
    await session.execute(text("RESET ROLE"))
    await session.execute(text("SELECT set_config('app.current_user_id', '', true)"))
    await session.execute(text("SELECT set_config('app.current_org_id', '', true)"))


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise")
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide ou expiré")
    user_id = payload.get("sub")
    org_id = payload.get("org")
    if not user_id or not org_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide")

    await session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)").bindparams(uid=user_id),
    )

    row = (
        await session.execute(
            text(
                "SELECT id, organization_id, full_name, email, onboarding_completed"
                " FROM users WHERE id = CAST(:id AS uuid) AND is_active = true"
            ).bindparams(id=user_id),
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable")

    membership = await get_membership(session, user_id, org_id)
    if membership is None or not membership.get("is_active"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Accès à cette organisation refusé")

    role = membership["role"]

    await _set_rls_context(session, user_id, org_id)
    user = dict(row)
    user["organization_id"] = org_id
    user["role"] = role
    user["org_slug"] = membership["slug"]
    user["org_name"] = membership["name"]
    return user


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants")
        return user

    return _dep
