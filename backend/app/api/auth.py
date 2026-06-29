"""Authentication — signup, login, multi-org switch, onboarding, invites."""

from __future__ import annotations

import json
import secrets
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import bootstrap_signup_rls, get_current_user, reset_rls_bootstrap
from app.auth.invite_code import check_invite_code, check_pilot_email, pilot_blocks_extra_orgs
from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    refresh_token_is_valid,
    revoke_refresh_token,
)
from app.auth.membership import create_membership, get_role_for_org, list_user_orgs
from app.auth.passwords import hash_password, verify_password
from app.config import settings
from app.db.session import get_db
from app.db.sql_compat import is_sqlite, now_sql, settings_column, trial_ends_sql
from app.delivery.email import notify_admin
from app.rate_limit import limiter
from app.services.industry_presets import ALL_MODULES, build_org_settings, preset_for_industry
from app.services.invites import insert_organization_invite
from app.services.org_profile import write_org_profile_memory
from app.services.slug import unique_org_slug
from app.trial import get_org_billing

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
ACCESS_COOKIE = "tb_access"
OAUTH_STATE_COOKIE = "tb_oauth_state"
COOKIE_PATH = "/api/auth"


def _set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


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
    """Deprecated — use unique_org_slug in async handlers."""
    from app.services.slug import slug_base

    return slug_base(name)


async def _load_pending_invite(
    session: AsyncSession, *, token: str | None = None, short_code: str | None = None
) -> dict | None:
    exp = f"expires_at > {now_sql()}"
    if short_code:
        code = short_code.strip().upper()
        row = (
            await session.execute(
                text(
                    "SELECT id, organization_id, email, role, token FROM organization_invites"
                    f" WHERE short_code = :code AND accepted_at IS NULL AND {exp}"
                ).bindparams(code=code),
            )
        ).mappings().first()
        return dict(row) if row else None
    if token:
        row = (
            await session.execute(
                text(
                    "SELECT id, organization_id, email, role, token FROM organization_invites"
                    f" WHERE token = :token AND accepted_at IS NULL AND {exp}"
                ).bindparams(token=token),
            )
        ).mappings().first()
        return dict(row) if row else None
    return None


async def _preview_invite_row(session: AsyncSession, *, token: str | None = None, short_code: str | None = None) -> dict | None:
    lookup_token = token
    if short_code and not token:
        inv = await _load_pending_invite(session, short_code=short_code)
        if not inv:
            return None
        lookup_token = inv["token"]
    if not lookup_token:
        return None
    row = (
        await session.execute(
            text(
                "SELECT i.email, i.role, i.expires_at, i.short_code, i.token, o.name AS org_name, o.slug,"
                " u.full_name AS inviter_name"
                " FROM organization_invites i"
                " JOIN organizations o ON o.id = i.organization_id"
                " LEFT JOIN users u ON u.id = i.invited_by"
                " WHERE i.token = :token AND i.accepted_at IS NULL"
            ).bindparams(token=lookup_token),
        )
    ).mappings().first()
    return dict(row) if row else None


def _user_payload(user_id: str, row: dict, org_slug: str) -> dict:
    return {
        "id": str(user_id),
        "full_name": row.get("full_name") or row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "organization_id": str(row["organization_id"]),
        "org_slug": org_slug,
        "onboarding_completed": row.get("onboarding_completed", False),
    }


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    password_confirm: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    organization_name: str = Field(min_length=2)
    industry: str = Field(default="other")
    team_size: str = Field(default="1-10")
    primary_language: str = Field(default="fr")
    invite_code: str = Field(min_length=1)


class InviteCodeIn(BaseModel):
    code: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class InviteOnboardIn(BaseModel):
    email: EmailStr
    role: str = "member"


class OnboardingIn(BaseModel):
    organization_name: str | None = Field(default=None, min_length=2)
    org_description: str | None = Field(default=None, max_length=2000)
    org_goals: str | None = Field(default=None, max_length=1000)
    industry: str | None = None
    team_size: str | None = None
    primary_language: str | None = None
    modules: list[str] = Field(default_factory=lambda: list(ALL_MODULES))
    invites: list[InviteOnboardIn] = Field(default_factory=list)


class SwitchOrgIn(BaseModel):
    organization_id: str


class CreateOrgIn(BaseModel):
    organization_name: str = Field(min_length=2)
    industry: str = Field(default="other")
    team_size: str = Field(default="1-10")
    primary_language: str = Field(default="fr")
    modules: list[str] = Field(default_factory=lambda: list(ALL_MODULES))
    invites: list[InviteOnboardIn] = Field(default_factory=list)


class AcceptInviteSignupIn(BaseModel):
    token: str | None = None
    short_code: str | None = None
    full_name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)
    password_confirm: str = Field(min_length=8)


class AcceptInviteLoginIn(BaseModel):
    token: str | None = None
    short_code: str | None = None
    email: EmailStr
    password: str


async def _load_user_session(session: AsyncSession, user_id: str, org_id: str) -> dict | None:
    row = (
        await session.execute(
            text(
                "SELECT u.id, u.full_name, u.email, u.onboarding_completed, u.organization_id,"
                " o.slug AS org_slug, om.role"
                " FROM users u"
                " JOIN org_memberships om ON om.user_id = u.id AND om.organization_id = CAST(:oid AS uuid)"
                " JOIN organizations o ON o.id = om.organization_id"
                " WHERE u.id = CAST(:uid AS uuid) AND om.is_active = true"
            ).bindparams(uid=user_id, oid=org_id),
        )
    ).mappings().first()
    return dict(row) if row else None


@router.post("/validate-invite-code")
@limiter.limit("10/minute")
async def validate_invite_code(request: Request, body: InviteCodeIn) -> dict:
    valid, message = check_invite_code(body.code)
    return {"valid": valid, "message": message}


@router.post("/signup")
@limiter.limit("5/minute")
async def signup(
    request: Request,
    response: Response,
    body: SignupIn,
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.password != body.password_confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Les mots de passe ne correspondent pas")
    valid, message = check_invite_code(body.invite_code)
    if not valid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, message)

    email_ok, email_msg = check_pilot_email(body.email)
    if not email_ok:
        raise HTTPException(status.HTTP_403_FORBIDDEN, email_msg)

    existing = (
        await session.execute(text("SELECT 1 FROM users WHERE email = :e").bindparams(e=body.email))
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cet email est déjà utilisé")

    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    slug = await unique_org_slug(session, body.organization_name)
    lang = body.primary_language if body.primary_language in ("fr", "en", "wo") else "fr"
    settings_json = build_org_settings(
        industry=body.industry,
        team_size=body.team_size,
        primary_language=body.primary_language,
        setup_checklist={
            "profile_completed": False,
            "team_invited": False,
            "first_project": False,
            "first_field_report": False,
            "first_meeting": False,
        },
    )

    await bootstrap_signup_rls(session, org_id=str(org_id), user_id=str(user_id))

    if is_sqlite():
        await session.execute(
            text(
                f"INSERT INTO organizations (id, name, slug, plan, settings, language, owner_id,"
                f" pricing_tier, trial_ends_at)"
                f" VALUES (:oid, :name, :slug, 'free', {settings_column()}, :lang,"
                f" :uid, 'free_trial', {trial_ends_sql()})"
            ).bindparams(
                oid=str(org_id),
                name=body.organization_name,
                slug=slug,
                settings=json.dumps(settings_json),
                lang=lang,
                uid=str(user_id),
            ),
        )
        await session.execute(
            text(
                "INSERT INTO users (id, organization_id, full_name, email, role, password_hash,"
                " onboarding_completed) VALUES (:uid, :oid, :name, :email, 'owner', :ph, 0)"
            ).bindparams(
                uid=str(user_id),
                oid=str(org_id),
                name=body.full_name,
                email=body.email,
                ph=hash_password(body.password),
            ),
        )
    else:
        await session.execute(
            text(
                "INSERT INTO organizations (id, name, slug, plan, settings, language, owner_id,"
                " pricing_tier, trial_ends_at)"
                " VALUES (CAST(:oid AS uuid), :name, :slug, 'free', CAST(:settings AS jsonb), :lang,"
                " CAST(:uid AS uuid), 'free_trial', now() + INTERVAL '30 days')"
            ).bindparams(
                oid=str(org_id),
                name=body.organization_name,
                slug=slug,
                settings=json.dumps(settings_json),
                lang=lang,
                uid=str(user_id),
            ),
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
    await create_membership(session, user_id=str(user_id), org_id=str(org_id), role="owner")
    channel_id = str(uuid.uuid4())
    if is_sqlite():
        await session.execute(
            text(
                "INSERT INTO channels (id, organization_id, name, is_direct, created_by)"
                " VALUES (:cid, :oid, 'general', 0, :uid)"
            ).bindparams(cid=channel_id, oid=str(org_id), uid=str(user_id)),
        )
    else:
        await session.execute(
            text(
                "INSERT INTO channels (id, organization_id, name, is_direct, created_by)"
                " VALUES (gen_random_uuid(), CAST(:oid AS uuid), 'general', false, CAST(:uid AS uuid))"
            ).bindparams(oid=str(org_id), uid=str(user_id)),
        )
    await session.commit()

    await notify_admin(
        event="signup",
        subject="Nouvelle inscription (propriétaire)",
        body=(
            f"Organisation : {body.organization_name}\n"
            f"Propriétaire : {body.full_name} <{body.email}>\n"
            f"Slug : {slug}\n"
            f"Secteur : {body.industry}"
        ),
    )

    access = create_access_token(user_id, org_id, "owner")
    refresh = await create_refresh_token(session, user_id, ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": _user_payload(str(user_id), {"full_name": body.full_name, "email": body.email, "role": "owner", "organization_id": org_id, "onboarding_completed": False}, slug),
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
        await session.execute(
            text(
                "SELECT id, full_name, email, password_hash, organization_id, onboarding_completed"
                " FROM users WHERE email = :e AND is_active = true"
            ).bindparams(e=body.email),
        )
    ).mappings().first()
    if row is None or not row["password_hash"] or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identifiants invalides")

    org_id = str(row["organization_id"])
    role = await get_role_for_org(session, str(row["id"]), org_id)
    if not role:
        orgs = await list_user_orgs(session, str(row["id"]))
        if not orgs:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Aucune organisation active")
        org_id = str(orgs[0]["id"])
        role = orgs[0]["role"]
        await session.execute(
            text("UPDATE users SET organization_id = CAST(:oid AS uuid) WHERE id = CAST(:uid AS uuid)").bindparams(
                oid=org_id, uid=str(row["id"])
            ),
        )
        await session.commit()

    session_row = await _load_user_session(session, str(row["id"]), org_id)
    if not session_row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session invalide")

    access = create_access_token(row["id"], org_id, role or "member")
    refresh = await create_refresh_token(session, row["id"], ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": _user_payload(str(row["id"]), {**dict(row), "role": role, "organization_id": org_id}, session_row["org_slug"]),
    }


@router.post("/refresh")
@limiter.limit("30/minute")
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
        await session.execute(
            text("SELECT id, organization_id FROM users WHERE id = CAST(:id AS uuid)").bindparams(id=user_id),
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable")

    org_id = str(row["organization_id"])
    role = await get_role_for_org(session, user_id, org_id)
    if not role:
        orgs = await list_user_orgs(session, user_id)
        if orgs:
            org_id = str(orgs[0]["id"])
            role = orgs[0]["role"]

    await revoke_refresh_token(session, token)
    access = create_access_token(row["id"], org_id, role or "member")
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
    response.delete_cookie(ACCESS_COOKIE, path="/", secure=settings.cookie_secure, httponly=True, samesite="lax")
    return {"status": "logged_out"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)) -> dict:
    org = (
        await session.execute(
            text(
                "SELECT slug, name, plan, settings, pricing_tier, trial_ends_at"
                " FROM organizations WHERE id = CAST(:oid AS uuid)"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().first()
    billing = await get_org_billing(session, str(user["organization_id"]))
    orgs = await list_user_orgs(session, str(user["id"]))
    return {
        "id": str(user["id"]),
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "organization_id": str(user["organization_id"]),
        "org_slug": org["slug"] if org else user.get("org_slug", ""),
        "org_name": org["name"] if org else user.get("org_name", ""),
        "onboarding_completed": user["onboarding_completed"],
        "settings": org["settings"] if org else {},
        "organizations": [
            {"id": str(o["id"]), "name": o["name"], "slug": o["slug"], "role": o["role"]}
            for o in orgs
        ],
        "billing": billing,
    }


@router.get("/orgs")
async def list_orgs(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_db)) -> dict:
    orgs = await list_user_orgs(session, str(user["id"]))
    return {
        "items": [
            {"id": str(o["id"]), "name": o["name"], "slug": o["slug"], "role": o["role"]}
            for o in orgs
        ],
    }


@router.post("/switch-org")
async def switch_org(
    body: SwitchOrgIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    role = await get_role_for_org(session, str(user["id"]), body.organization_id)
    if not role:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous n'appartenez pas à cette organisation")
    await session.execute(
        text("UPDATE users SET organization_id = CAST(:oid AS uuid) WHERE id = CAST(:uid AS uuid)").bindparams(
            oid=body.organization_id, uid=str(user["id"])
        ),
    )
    await session.commit()
    session_row = await _load_user_session(session, str(user["id"]), body.organization_id)
    access = create_access_token(user["id"], body.organization_id, role)
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": _user_payload(
            str(user["id"]),
            {**user, "role": role, "organization_id": body.organization_id},
            session_row["org_slug"] if session_row else "",
        ),
    }


@router.post("/create-org")
async def create_org_for_user(
    body: CreateOrgIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Logged-in user creates an additional organization (multi-org)."""
    if pilot_blocks_extra_orgs():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Création d'organisation supplémentaire désactivée pendant le pilote.",
        )
    await reset_rls_bootstrap(session)
    org_id = uuid.uuid4()
    slug = await unique_org_slug(session, body.organization_name)
    lang = body.primary_language if body.primary_language in ("fr", "en", "wo") else "fr"
    preset = preset_for_industry(body.industry)
    modules = [m for m in body.modules if m in ALL_MODULES] or preset["modules"]
    settings_json = build_org_settings(
        industry=body.industry,
        team_size=body.team_size,
        primary_language=body.primary_language,
        modules=modules,
        setup_checklist={
            "profile_completed": True,
            "team_invited": bool(body.invites),
            "first_project": False,
            "first_field_report": False,
            "first_meeting": False,
        },
    )
    await session.execute(
        text(
            "INSERT INTO organizations (id, name, slug, plan, settings, language, owner_id,"
            " pricing_tier, trial_ends_at)"
            " VALUES (CAST(:oid AS uuid), :name, :slug, 'free', CAST(:settings AS jsonb), :lang,"
            " CAST(:uid AS uuid), 'free_trial', now() + INTERVAL '30 days')"
        ).bindparams(
            oid=str(org_id),
            name=body.organization_name,
            slug=slug,
            settings=json.dumps(settings_json),
            lang=lang if lang in ("fr", "en") else "fr",
            uid=str(user["id"]),
        ),
    )
    await create_membership(session, user_id=str(user["id"]), org_id=str(org_id), role="owner")
    await session.execute(
        text(
            "INSERT INTO channels (id, organization_id, name, is_direct, created_by)"
            " VALUES (gen_random_uuid(), CAST(:oid AS uuid), 'general', false, CAST(:uid AS uuid))"
        ).bindparams(oid=str(org_id), uid=str(user["id"])),
    )
    await session.execute(
        text("UPDATE users SET organization_id = CAST(:oid AS uuid) WHERE id = CAST(:uid AS uuid)").bindparams(
            oid=str(org_id), uid=str(user["id"])
        ),
    )
    for inv in body.invites:
        if inv.role not in ("admin", "manager", "member", "field_agent"):
            continue
        await insert_organization_invite(
            session,
            org_id=str(org_id),
            email=inv.email,
            role=inv.role,
            invited_by=str(user["id"]),
        )
    await session.commit()

    org_name_row = (
        await session.execute(
            text("SELECT name FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(oid=str(org_id)),
        )
    ).scalar()
    await write_org_profile_memory(
        session,
        org_id=str(org_id),
        name=str(org_name_row or body.organization_name),
        settings=settings_json,
    )
    await session.commit()

    await notify_admin(
        event="create_org",
        subject="Nouvelle organisation créée",
        body=(
            f"Organisation : {body.organization_name}\n"
            f"Créée par : {user.get('full_name')} <{user.get('email')}>\n"
            f"Slug : {slug}"
        ),
    )

    access = create_access_token(user["id"], org_id, "owner")
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": _user_payload(
            str(user["id"]),
            {
                **user,
                "role": "owner",
                "organization_id": org_id,
                "onboarding_completed": True,
            },
            slug,
        ),
    }


@router.post("/onboarding")
async def complete_onboarding(
    body: OnboardingIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    org_row = (
        await session.execute(
            text("SELECT name, settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                oid=str(user["organization_id"])
            ),
        )
    ).mappings().first()
    existing = org_row["settings"] if org_row and org_row["settings"] else {}
    if isinstance(existing, str):
        existing = json.loads(existing)
    org_name = org_row["name"] if org_row else "Organisation"

    industry = body.industry or existing.get("industry", "other")
    preset = preset_for_industry(industry)
    modules = [m for m in body.modules if m in ALL_MODULES] or preset["modules"]
    if body.org_description is not None:
        existing["org_description"] = body.org_description.strip()
    if body.org_goals is not None:
        existing["org_goals"] = body.org_goals.strip()
    settings_json = {
        **existing,
        "industry": industry,
        "team_size": body.team_size or existing.get("team_size", "1-10"),
        "primary_language": body.primary_language or existing.get("primary_language", "fr"),
        "modules": modules,
        "terminology": preset["terminology"],
        "setup_checklist": existing.get(
            "setup_checklist",
            {
                "profile_completed": True,
                "team_invited": False,
                "first_project": False,
                "first_field_report": False,
                "first_meeting": False,
            },
        ),
    }
    settings_json["setup_checklist"]["profile_completed"] = True
    lang = body.primary_language or existing.get("primary_language", "fr")
    if lang == "wo":
        lang = "fr"

    if body.organization_name and body.organization_name.strip():
        org_name = body.organization_name.strip()
        await session.execute(
            text("UPDATE organizations SET name = :name WHERE id = CAST(:oid AS uuid)").bindparams(
                name=org_name, oid=str(user["organization_id"])
            ),
        )

    await session.execute(
        text(
            "UPDATE organizations SET settings = CAST(:s AS jsonb), language = :lang"
            " WHERE id = CAST(:oid AS uuid)"
        ).bindparams(s=json.dumps(settings_json), lang=lang if lang in ("fr", "en") else "fr", oid=str(user["organization_id"])),
    )

    created_invites: list[dict[str, str]] = []
    for inv in body.invites:
        if inv.role not in ("admin", "manager", "member", "field_agent"):
            continue
        created = await insert_organization_invite(
            session,
            org_id=str(user["organization_id"]),
            email=inv.email,
            role=inv.role,
            invited_by=str(user["id"]),
        )
        created_invites.append({**created, "email": inv.email})
    if body.invites:
        settings_json["setup_checklist"]["team_invited"] = True

    await session.execute(
        text(
            "UPDATE organizations SET settings = CAST(:s AS jsonb) WHERE id = CAST(:oid AS uuid)"
        ).bindparams(s=json.dumps(settings_json), oid=str(user["organization_id"])),
    )
    await session.execute(
        text("UPDATE users SET onboarding_completed = true WHERE id = CAST(:uid AS uuid)").bindparams(
            uid=str(user["id"])
        ),
    )

    await write_org_profile_memory(
        session,
        org_id=str(user["organization_id"]),
        name=org_name,
        settings=settings_json,
    )
    await session.commit()

    for inv in created_invites:
        await notify_admin(
            event="team_invite",
            subject="Invitation équipe créée",
            body=(
                f"Organisation : {org_name}\n"
                f"Email invité : {inv.get('email', '')}\n"
                f"Code : {inv.get('short_code', '')}\n"
                f"Lien : {settings.frontend_url.rstrip('/')}{inv.get('invite_url', '')}"
            ),
        )

    await notify_admin(
        event="onboarding_complete",
        subject="Onboarding organisation terminé",
        body=(
            f"Organisation : {org_name}\n"
            f"Utilisateur : {user.get('full_name')} <{user.get('email')}>\n"
            f"Secteur : {industry}\n"
            f"Description : {(settings_json.get('org_description') or '')[:500]}"
        ),
    )

    return {"status": "completed", "settings": settings_json}


@router.get("/invite/{token}")
async def preview_invite(token: str, session: AsyncSession = Depends(get_db)) -> dict:
    row = await _preview_invite_row(session, token=token)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation invalide ou expirée")
    return dict(row)


@router.get("/invite/code/{code}")
async def preview_invite_by_code(code: str, session: AsyncSession = Depends(get_db)) -> dict:
    row = await _preview_invite_row(session, short_code=code)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Code d'invitation invalide ou expiré")
    return dict(row)


@router.post("/invite/accept-signup")
@limiter.limit("5/minute")
async def accept_invite_signup(
    request: Request,
    response: Response,
    body: AcceptInviteSignupIn,
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.password != body.password_confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Les mots de passe ne correspondent pas")
    if not body.token and not body.short_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token ou code d'invitation requis")
    invite = await _load_pending_invite(session, token=body.token, short_code=body.short_code)
    if not invite:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation invalide ou expirée")
    if body.email.lower() != invite["email"].lower():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "L'email ne correspond pas à l'invitation")

    existing = (
        await session.execute(text("SELECT 1 FROM users WHERE email = :e").bindparams(e=body.email))
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Compte existant — connectez-vous pour accepter")

    user_id = uuid.uuid4()
    org_id = str(invite["organization_id"])
    await bootstrap_signup_rls(session, org_id=org_id, user_id=str(user_id))
    await session.execute(
        text(
            "INSERT INTO users (id, organization_id, full_name, email, role, password_hash,"
            " onboarding_completed) VALUES (CAST(:uid AS uuid), CAST(:oid AS uuid), :name, :email,"
            " :role, :ph, true)"
        ).bindparams(
            uid=str(user_id),
            oid=org_id,
            name=body.full_name,
            email=body.email,
            role=invite["role"],
            ph=hash_password(body.password),
        ),
    )
    await create_membership(session, user_id=str(user_id), org_id=org_id, role=invite["role"])
    await session.execute(
        text(
            "UPDATE organization_invites SET accepted_at = now() WHERE id = CAST(:iid AS uuid)"
        ).bindparams(iid=str(invite["id"])),
    )
    slug = (
        await session.execute(
            text("SELECT slug, name FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(oid=org_id),
        )
    ).mappings().first()
    await session.commit()

    org_label = slug["name"] if slug else org_id
    await notify_admin(
        event="invite_accept_signup",
        subject="Nouveau membre via invitation",
        body=(
            f"Organisation : {org_label}\n"
            f"Membre : {body.full_name} <{body.email}>\n"
            f"Rôle : {invite['role']}"
        ),
    )

    access = create_access_token(user_id, org_id, invite["role"])
    refresh = await create_refresh_token(session, user_id, ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": _user_payload(str(user_id), {"full_name": body.full_name, "email": body.email, "role": invite["role"], "organization_id": org_id, "onboarding_completed": True}, slug["slug"] if slug else ""),
    }


@router.post("/invite/accept-login")
@limiter.limit("10/minute")
async def accept_invite_login(
    request: Request,
    response: Response,
    body: AcceptInviteLoginIn,
    session: AsyncSession = Depends(get_db),
) -> dict:
    if not body.token and not body.short_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token ou code d'invitation requis")
    invite = await _load_pending_invite(session, token=body.token, short_code=body.short_code)
    if not invite:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation invalide ou expirée")

    row = (
        await session.execute(
            text(
                "SELECT id, full_name, email, password_hash, onboarding_completed"
                " FROM users WHERE email = :e AND is_active = true"
            ).bindparams(e=body.email),
        )
    ).mappings().first()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identifiants invalides")

    org_id = str(invite["organization_id"])
    await create_membership(session, user_id=str(row["id"]), org_id=org_id, role=invite["role"])
    await session.execute(
        text(
            "UPDATE organization_invites SET accepted_at = now() WHERE id = CAST(:iid AS uuid)"
        ).bindparams(iid=str(invite["id"])),
    )
    await session.execute(
        text("UPDATE users SET organization_id = CAST(:oid AS uuid) WHERE id = CAST(:uid AS uuid)").bindparams(
            oid=org_id, uid=str(row["id"])
        ),
    )
    slug = (
        await session.execute(
            text("SELECT slug, name FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(oid=org_id),
        )
    ).mappings().first()
    await session.commit()

    org_label = slug["name"] if slug else org_id
    await notify_admin(
        event="invite_accept_login",
        subject="Membre existant a rejoint une organisation",
        body=(
            f"Organisation : {org_label}\n"
            f"Membre : {row['full_name']} <{row['email']}>\n"
            f"Rôle : {invite['role']}"
        ),
    )

    access = create_access_token(row["id"], org_id, invite["role"])
    refresh = await create_refresh_token(session, row["id"], ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": _user_payload(
            str(row["id"]),
            {**dict(row), "role": invite["role"], "organization_id": org_id},
            slug["slug"] if slug else "",
        ),
    }


@router.get("/google")
async def google_oauth_start(response: Response) -> dict:
    if not settings.google_oauth_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth non configuré")
    state = secrets.token_urlsafe(32)
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=COOKIE_PATH,
    )
    params = urlencode(
        {
            "client_id": settings.google_oauth_client_id,
            "redirect_uri": settings.google_oauth_redirect,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.get("/google/callback")
async def google_oauth_callback(
    code: str,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db),
    state: str | None = None,
):
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth non configuré")

    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not state or not cookie_state or not secrets.compare_digest(state, cookie_state):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "État OAuth invalide — réessayez")
    response.delete_cookie(
        OAUTH_STATE_COOKIE,
        path=COOKIE_PATH,
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "redirect_uri": settings.google_oauth_redirect,
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
    if not profile.get("email_verified"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email Google non vérifié")

    row = (
        await session.execute(
            text(
                "SELECT u.id, u.organization_id, o.slug FROM users u"
                " JOIN organizations o ON o.id = u.organization_id"
                " WHERE u.email = :e OR u.google_sub = :gs"
            ).bindparams(e=email, gs=google_sub),
        )
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Aucun compte associé. Inscrivez-vous d'abord avec cet email.",
        )

    role = await get_role_for_org(session, str(row["id"]), str(row["organization_id"])) or "member"
    await session.execute(
        text("UPDATE users SET google_sub = :gs WHERE id = CAST(:uid AS uuid)").bindparams(
            gs=google_sub, uid=str(row["id"])
        ),
    )
    await session.commit()

    access = create_access_token(row["id"], row["organization_id"], role)
    refresh = await create_refresh_token(session, row["id"], ip=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh)
    _set_access_cookie(response, access)

    from fastapi.responses import RedirectResponse

    return RedirectResponse(
        f"{settings.frontend_url}/{row['slug']}/dashboard",
        status_code=302,
    )
