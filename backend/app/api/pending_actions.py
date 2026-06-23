"""Pending action approval API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.services.pending_actions import (
    approve_pending_action,
    count_pending_actions,
    list_pending_actions,
    reject_pending_action,
)

router = APIRouter(prefix="/api/pending-actions", tags=["pending-actions"])

ADMIN_ROLES = frozenset({"owner", "admin"})


def _is_admin(user: dict) -> bool:
    return user.get("role") in ADMIN_ROLES


@router.get("")
async def get_pending_actions(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    items = await list_pending_actions(session, oid)
    if not _is_admin(user):
        items = []
    return {
        "items": items,
        "pending_count": await count_pending_actions(session, oid) if _is_admin(user) else 0,
        "can_approve": _is_admin(user),
    }


@router.post("/{action_id}/approve")
async def approve_action(
    action_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if not _is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seuls les administrateurs peuvent approuver")
    try:
        return await approve_pending_action(
            session,
            org_id=str(user["organization_id"]),
            action_id=action_id,
            reviewer_id=str(user["id"]),
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/{action_id}/reject")
async def reject_action(
    action_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if not _is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seuls les administrateurs peuvent rejeter")
    try:
        return await reject_pending_action(
            session,
            org_id=str(user["organization_id"]),
            action_id=action_id,
            reviewer_id=str(user["id"]),
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
