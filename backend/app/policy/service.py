"""Load and merge default + per-org policy overrides."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.policy.models import POLICY_KEYS, OrgPolicy, validate_policy_patch

_DEFAULT_PATH = Path(__file__).resolve().parent / "default_policy.yaml"


@lru_cache
def load_default_policy() -> OrgPolicy:
    with _DEFAULT_PATH.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return OrgPolicy.from_mapping(raw)


def merge_policy(defaults: OrgPolicy, overrides: dict[str, Any] | None) -> OrgPolicy:
    base = defaults.as_dict()
    if overrides:
        for key in POLICY_KEYS:
            if key in overrides and overrides[key] is not None:
                base[key] = overrides[key]
    return OrgPolicy.from_mapping(base)


class PolicyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._defaults = load_default_policy()

    async def get_overrides(self, org_id: str) -> dict[str, float | int]:
        row = (
            await self.session.execute(
                text("SELECT settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                    oid=org_id,
                ),
            )
        ).mappings().first()
        if not row:
            return {}
        settings = row["settings"] or {}
        if isinstance(settings, str):
            settings = json.loads(settings)
        policy = settings.get("policy") if isinstance(settings, dict) else None
        if not isinstance(policy, dict):
            return {}
        return {k: policy[k] for k in POLICY_KEYS if k in policy}

    async def get_effective_policy(self, org_id: str) -> OrgPolicy:
        overrides = await self.get_overrides(org_id)
        return merge_policy(self._defaults, overrides)

    async def get_policy_view(self, org_id: str) -> dict:
        overrides = await self.get_overrides(org_id)
        effective = merge_policy(self._defaults, overrides)
        return {
            "defaults": self._defaults.as_dict(),
            "overrides": overrides,
            "effective": effective.as_dict(),
        }

    async def update_overrides(self, org_id: str, patch: dict[str, Any]) -> dict:
        cleaned_patch = validate_policy_patch(patch)
        row = (
            await self.session.execute(
                text("SELECT settings FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(
                    oid=org_id,
                ),
            )
        ).mappings().first()
        settings: dict[str, Any] = {}
        if row and row["settings"]:
            settings = row["settings"]
            if isinstance(settings, str):
                settings = json.loads(settings)
        policy = dict(settings.get("policy") or {})
        defaults = self._defaults.as_dict()
        for key, val in cleaned_patch.items():
            if val == defaults[key]:
                policy.pop(key, None)
            else:
                policy[key] = val
        if policy:
            settings["policy"] = policy
        else:
            settings.pop("policy", None)
        await self.session.execute(
            text("UPDATE organizations SET settings = CAST(:s AS jsonb) WHERE id = CAST(:oid AS uuid)").bindparams(
                s=json.dumps(settings),
                oid=org_id,
            ),
        )
        await self.session.commit()
        return await self.get_policy_view(org_id)
