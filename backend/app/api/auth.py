"""Authentication — signup, login, refresh, Google OAuth."""

from __future__ import annotations

import secrets
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    refresh_token_is_valid,
    revoke_refresh_token,
)
from app.auth.passwords import hash_password, verify_password
from app.config import settings
from app.db.session import get_db
from app.rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
COOKIE_PATH = "/api/auth"


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    organization_name: str = Field(min_length=2)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class OnboardingIn(BaseModel):
    org_type: str
    team_size: str
    work_style: str
    primary_language: str
    key_pain: str


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=COOKIE_PATH,
    )


def _slugify(name: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
    return f"{base}-{secrets.token_hex(3)}"


@router.post("/signup")
@limiter.limit("5/minute")
async def signup(
    request: Request,
    response: Response,
    body: SignupIn,
    session: AsyncSession = Depends(get_db),
) -> dict:
    existing = (
        await session.execute(text("SELECT 1 FROM users WHERE email = :e").bindparams(e=body.email))
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cet email est déjà utilisé")

    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    slug = _slugify(body.organization_name)

    await session.execute(
        text(
            "INSERT INTO organizations (id, name, slug, plan, settings, language, owner_id)"
            " VALUES (CAST(:oid AS uuid), :name, :slug, 'free', '{}', 'fr', CAST(:uid AS uuid))"
        ).bindparams(oid=str(org_id), name=body.organization_name, slug=slug, uid=str(user_id)),
    )
    await session.execute(
        text(
            "INSERT INTO users (id, organization_id, full_name, email, role, password_hash,"
            " onboarding_completed) VALUES (CAST(:uid AS uuid), CAST(:oid AS uuid), :name, :email,"
            " 'owner', :ph, false)"
        ).bindparams(
            uid=str(user_id),
            oid=str(org_id),
            name=body.full_name,
            email=body.email,
            ph=hash_password(body.password),
        ),
    )
    await session.execute(
        text(
            "INSERT INTO channels (id, organization_id, name, is_direct, created_by)"
            " VALUES (gen_random_uuid(), CAST(:oid AS uuid), 'general', false, CAST(:uid AS uuid))"
        ).bindparams(oid=str(org_id), uid=str(user_id)),
    )
    await session.commit()

    access = create_access_token(user_id, org_id, "owner")
    refresh = await create_refresh_token(session, user_id, ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": {
            "id": str(user_id),
            "full_name": body.full_name,
            "email": body.email,
            "role": "owner",
            "organization_id": str(org_id),
            "org_slug": slug,
            "onboarding_completed": False,
        },
    }


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginIn,
    session: AsyncSession = Depends(get_db),
) -> dict:
    row = (
        (
            await session.execute(
                text(
                    "SELECT u.id, u.full_name, u.email, u.role, u.password_hash, u.organization_id,"
                    " u.onboarding_completed, o.slug AS org_slug"
                    " FROM users u JOIN organizations o ON o.id = u.organization_id"
                    " WHERE u.email = :e AND u.is_active = true"
                ).bindparams(e=body.email),
            )
        )
        .mappings()
        .first()
    )
    if (
        row is None
        or not row["password_hash"]
        or not verify_password(body.password, row["password_hash"])
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identifiants invalides")

    access = create_access_token(row["id"], row["organization_id"], row["role"])
    refresh = await create_refresh_token(session, row["id"], ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": {
            "id": str(row["id"]),
            "full_name": row["full_name"],
            "email": row["email"],
            "role": row["role"],
            "organization_id": str(row["organization_id"]),
            "org_slug": row["org_slug"],
            "onboarding_completed": row["onboarding_completed"],
        },
    }


@router.post("/refresh")
async def refresh(
    request: Request, response: Response, session: AsyncSession = Depends(get_db)
) -> dict:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée")
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide")
    if not await refresh_token_is_valid(session, token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée")

    user_id = payload["sub"]
    row = (
        (
            await session.execute(
                text(
                    "SELECT id, role, organization_id FROM users WHERE id = CAST(:id AS uuid)"
                ).bindparams(id=user_id),
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable")

    await revoke_refresh_token(session, token)
    access = create_access_token(row["id"], row["organization_id"], row["role"])
    new_refresh = await create_refresh_token(session, row["id"], ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, new_refresh)
    return {"access_token": access, "token_type": "bearer"}


@router.post("/logout")
async def logout(
    request: Request, response: Response, session: AsyncSession = Depends(get_db)
) -> dict:
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        await revoke_refresh_token(session, token)
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, secure=settings.cookie_secure, httponly=True, samesite="lax")
    return {"status": "logged_out"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)) -> dict:
    org = (
        (
            await session.execute(
                text("SELECT slug, name, plan, settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                    oid=str(user["organization_id"])
                ),
            )
        )
        .mappings()
        .first()
    )
    return {
        "id": str(user["id"]),
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "organization_id": str(user["organization_id"]),
        "org_slug": org["slug"] if org else "",
        "org_name": org["name"] if org else "",
        "onboarding_completed": user["onboarding_completed"],
        "settings": org["settings"] if org else {},
    }


@router.post("/onboarding")
async def complete_onboarding(
    body: OnboardingIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    import json

    settings_json = {
        "org_type": body.org_type,
        "team_size": body.team_size,
        "work_style": body.work_style,
        "primary_language": body.primary_language,
        "key_pain": body.key_pain,
    }
    await session.execute(
        text(
            "UPDATE organizations SET settings = CAST(:s AS jsonb), language = :lang"
            " WHERE id = CAST(:oid AS uuid)"
        ).bindparams(
            s=json.dumps(settings_json),
            lang=body.primary_language if body.primary_language != "both" else "fr",
            oid=str(user["organization_id"]),
        ),
    )
    await session.execute(
        text("UPDATE users SET onboarding_completed = true WHERE id = CAST(:uid AS uuid)").bindparams(
            uid=str(user["id"])
        ),
    )
    await session.commit()
    return {"status": "completed", "settings": settings_json}


@router.get("/google")
async def google_oauth_start() -> dict:
    if not settings.google_oauth_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth non configuré")
    params = urlencode(
        {
            "client_id": settings.google_oauth_client_id,
            "redirect_uri": settings.google_oauth_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.get("/google/callback")
async def google_oauth_callback(
    code: str,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth non configuré")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "redirect_uri": settings.google_oauth_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Échec OAuth Google")
        tokens = token_resp.json()
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        profile = user_resp.json()

    email = profile.get("email")
    google_sub = profile.get("sub")

    row = (
        (
            await session.execute(
                text(
                    "SELECT u.id, u.role, u.organization_id, o.slug FROM users u"
                    " JOIN organizations o ON o.id = u.organization_id"
                    " WHERE u.email = :e OR u.google_sub = :gs"
                ).bindparams(e=email, gs=google_sub),
            )
        )
        .mappings()
        .first()
    )

    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Aucun compte associé. Inscrivez-vous d'abord avec cet email.",
        )

    await session.execute(
        text("UPDATE users SET google_sub = :gs WHERE id = CAST(:uid AS uuid)").bindparams(
            gs=google_sub, uid=str(row["id"])
        ),
    )
    await session.commit()

    access = create_access_token(row["id"], row["organization_id"], row["role"])
    refresh = await create_refresh_token(session, row["id"], ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)

    from fastapi.responses import RedirectResponse

    return RedirectResponse(
        f"{settings.frontend_url}/{row['slug']}/dashboard?token={access}",
        status_code=302,
    )
