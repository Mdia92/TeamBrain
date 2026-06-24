"""Automation rules CRUD — admin/owner only."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.automation.models import (
    ACTION_LABELS_FR,
    ACTION_TYPES,
    TRIGGER_LABELS_FR,
    TRIGGER_TYPES,
)
from app.automation.service import AutomationService
from app.db.session import get_db

router = APIRouter(prefix="/api/automations", tags=["automations"])


class AutomationRuleIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    trigger_type: str
    trigger_config: dict[str, Any] = Field(default_factory=dict)
    action_type: str
    action_config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class AutomationRulePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    trigger_type: str | None = None
    trigger_config: dict[str, Any] | None = None
    action_type: str | None = None
    action_config: dict[str, Any] | None = None
    is_active: bool | None = None


@router.get("/meta")
async def automation_meta() -> dict:
    return {
        "triggers": [{"id": t, "label": TRIGGER_LABELS_FR[t]} for t in sorted(TRIGGER_TYPES)],
        "actions": [{"id": a, "label": ACTION_LABELS_FR[a]} for a in sorted(ACTION_TYPES)],
    }


@router.get("")
async def list_automations(
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    svc = AutomationService(session)
    items = await svc.list_rules(str(user["organization_id"]))
    return {"items": items}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_automation(
    body: AutomationRuleIn,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    svc = AutomationService(session)
    try:
        rule = await svc.create_rule(
            str(user["organization_id"]),
            name=body.name,
            trigger_type=body.trigger_type,
            trigger_config=body.trigger_config,
            action_type=body.action_type,
            action_config=body.action_config,
            is_active=body.is_active,
            created_by=str(user["id"]),
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return rule


@router.get("/{rule_id}")
async def get_automation(
    rule_id: str,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    svc = AutomationService(session)
    rule = await svc.get_rule(str(user["organization_id"]), rule_id)
    if not rule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Règle introuvable")
    return rule


@router.patch("/{rule_id}")
async def patch_automation(
    rule_id: str,
    body: AutomationRulePatch,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    svc = AutomationService(session)
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Aucune modification")
    try:
        return await svc.update_rule(str(user["organization_id"]), rule_id, patch)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(
    rule_id: str,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> None:
    svc = AutomationService(session)
    if not await svc.delete_rule(str(user["organization_id"]), rule_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Règle introuvable")
