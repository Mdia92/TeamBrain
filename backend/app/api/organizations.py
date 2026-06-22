"""Organization settings and billing."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.trial import get_org_billing

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


class SettingsPatchIn(BaseModel):
    modules: list[str] | None = None


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
