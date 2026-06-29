"""Organization settings and billing."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.policy import PolicyService
from app.policy.models import validate_policy_patch
from app.trial import get_org_billing

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


class SettingsPatchIn(BaseModel):
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
            text("SELECT settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                oid=str(user["organization_id"])
            ),
        )
    ).mappings().first()
    settings = row["settings"] if row else {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    if body.modules is not None:
        settings["modules"] = body.modules
    await session.execute(
        text("UPDATE organizations SET settings = CAST(:s AS jsonb) WHERE id = CAST(:oid AS uuid)").bindparams(
            s=json.dumps(settings), oid=str(user["organization_id"])
        ),
    )
    await session.commit()
    return {"settings": settings}


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
