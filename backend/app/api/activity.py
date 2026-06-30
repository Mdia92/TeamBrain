"""Activity revision for cross-module live sync."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.services.org_activity import get_activity_revision

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("/revision")
async def activity_revision(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    revision = await get_activity_revision(session, str(user["organization_id"]))
    return {"revision": revision}
