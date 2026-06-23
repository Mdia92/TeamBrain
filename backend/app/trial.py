"""Free trial and read-only mode checks."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db

PAID_TIERS = frozenset({"starter", "pro", "enterprise"})


async def get_org_billing(session: AsyncSession, org_id: str) -> dict:
    row = (
        await session.execute(
            text(
                "SELECT pricing_tier, trial_ends_at, plan FROM organizations"
                " WHERE id = CAST(:oid AS uuid)"
            ).bindparams(oid=org_id),
        )
    ).mappings().first()
    if not row:
        return {"pricing_tier": "free_trial", "trial_ends_at": None, "is_read_only": False}
    tier = row["pricing_tier"] or "free_trial"
    ends = row["trial_ends_at"]
    read_only = tier == "free_trial" and ends is not None and ends.replace(tzinfo=UTC) < datetime.now(UTC)
    if tier in PAID_TIERS:
        read_only = False
    days_left = None
    if tier == "free_trial" and ends:
        delta = (ends.replace(tzinfo=UTC) - datetime.now(UTC)).days
        days_left = max(0, delta)
    return {
        "pricing_tier": tier,
        "trial_ends_at": ends.isoformat() if ends else None,
        "trial_days_left": days_left,
        "is_read_only": read_only,
    }


async def require_write_access(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    billing = await get_org_billing(session, str(user["organization_id"]))
    if billing["is_read_only"]:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Votre essai est terminé — mode lecture seule. Passez à un forfait payant.",
        )
    return user
