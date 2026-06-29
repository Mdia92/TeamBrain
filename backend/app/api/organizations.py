"""Organization settings and billing."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.db.sql_compat import is_sqlite, settings_column
from app.delivery.email import notify_admin
from app.policy import PolicyService
from app.policy.models import validate_policy_patch
from app.services.org_profile import write_org_profile_memory
from app.trial import get_org_billing

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


class SettingsPatchIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    org_description: str | None = Field(default=None, max_length=2000)
    org_goals: str | None = Field(default=None, max_length=1000)
    modules: list[str] | None = None


class PolicyPatchIn(BaseModel):
    overdue_task_days: int | None = Field(default=None, ge=0, le=90)
    commitment_reminder_hours_before: int | None = Field(default=None, ge=1, le=168)
    field_report_gap_days: int | None = Field(default=None, ge=1, le=90)
    memory_dedup_similarity: float | None = Field(default=None, ge=0.5, le=1.0)
    memory_decay_months: int | None = Field(default=None, ge=1, le=36)
    assistant_confidence_min: float | None = Field(default=None, ge=0.1, le=1.0)
    auto_action_confidence_min: float | None = Field(default=None, ge=0.1, le=1.0)


@router.get("/current/billing")
async def get_billing(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await get_org_billing(session, str(user["organization_id"]))


@router.get("/current/settings")
async def get_settings(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    row = (
        await session.execute(
            text(
                "SELECT name, slug, settings, pricing_tier, trial_ends_at, language"
                " FROM organizations WHERE id = CAST(:oid AS uuid)"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().first()
    billing = await get_org_billing(session, str(user["organization_id"]))
    return {**dict(row), "billing": billing}


@router.patch("/current/settings")
async def patch_settings(
    body: SettingsPatchIn,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    row = (
        await session.execute(
            text("SELECT name, settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                oid=str(user["organization_id"])
            ),
        )
    ).mappings().first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organisation introuvable")

    settings = row["settings"] if row else {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    org_name = row["name"]

    if body.name is not None:
        org_name = body.name.strip()
        await session.execute(
            text("UPDATE organizations SET name = :name WHERE id = CAST(:oid AS uuid)").bindparams(
                name=org_name, oid=str(user["organization_id"])
            ),
        )
    if body.org_description is not None:
        settings["org_description"] = body.org_description.strip()
    if body.org_goals is not None:
        settings["org_goals"] = body.org_goals.strip()
    if body.modules is not None:
        settings["modules"] = body.modules

    if is_sqlite():
        await session.execute(
            text(
                f"UPDATE organizations SET settings = {settings_column()} WHERE id = :oid"
            ).bindparams(settings=json.dumps(settings), oid=str(user["organization_id"])),
        )
    else:
        await session.execute(
            text("UPDATE organizations SET settings = CAST(:s AS jsonb) WHERE id = CAST(:oid AS uuid)").bindparams(
                s=json.dumps(settings), oid=str(user["organization_id"])
            ),
        )

    await write_org_profile_memory(
        session,
        org_id=str(user["organization_id"]),
        name=org_name,
        settings=settings,
    )
    await session.commit()

    if body.name is not None or body.org_description is not None or body.org_goals is not None:
        await notify_admin(
            event="org_profile_update",
            subject="Profil organisation mis à jour",
            body=(
                f"Organisation : {org_name}\n"
                f"Modifié par : {user.get('full_name')} <{user.get('email')}>\n"
                f"Description : {(settings.get('org_description') or '')[:500]}"
            ),
        )

    return {"name": org_name, "settings": settings}


@router.get("/current/policy")
async def get_policy(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    svc = PolicyService(session)
    return await svc.get_policy_view(str(user["organization_id"]))


@router.patch("/current/policy")
async def patch_policy(
    body: PolicyPatchIn,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Aucune valeur à mettre à jour")
    try:
        validate_policy_patch(patch)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    svc = PolicyService(session)
    return await svc.update_overrides(str(user["organization_id"]), patch)
