"""Auth dependencies — multi-tenant RLS context."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
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

    row = (
        (
            await session.execute(
                text(
                    "SELECT id, organization_id, full_name, email, role, onboarding_completed"
                    " FROM users WHERE id = CAST(:id AS uuid) AND is_active = true"
                ).bindparams(id=user_id),
            )
        )
        .mappings()
        .first()
    )
    if row is None or str(row["organization_id"]) != org_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable")

    await _set_rls_context(session, user_id, org_id)
    return dict(row)


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants")
        return user

    return _dep
