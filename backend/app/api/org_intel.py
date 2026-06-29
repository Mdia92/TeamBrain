"""Org-level module findings and synthesis."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.services.module_findings import list_findings, synthesize_findings

router = APIRouter(prefix="/api/org", tags=["org-intel"])


@router.get("/findings")
async def get_org_findings(
    last_hours: int = Query(24, alias="last_24h", ge=1, le=168),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    items = await list_findings(session, oid, hours=last_hours)
    return {"items": items, "hours": last_hours}


@router.get("/synthesis")
async def get_org_synthesis(
    last_hours: int = Query(24, ge=1, le=168),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    items = await list_findings(session, oid, hours=last_hours)
    return synthesize_findings(items)
