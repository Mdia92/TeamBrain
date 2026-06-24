"""CRUD for per-org automation rules."""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.automation.models import validate_action_type, validate_trigger_type


class AutomationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_rules(self, org_id: str, *, active_only: bool = False) -> list[dict]:
        clause = " AND is_active = true" if active_only else ""
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, name, trigger_type, trigger_config, action_type, action_config,"
                    " is_active, created_by, created_at, updated_at"
                    " FROM automation_rules"
                    " WHERE organization_id = CAST(:oid AS uuid)"
                    f"{clause}"
                    " ORDER BY created_at DESC"
                ).bindparams(oid=org_id),
            )
        ).mappings().all()
        return [self._serialize(r) for r in rows]

    async def get_active_for_trigger(self, org_id: str, trigger_type: str) -> list[dict]:
        rows = (
            await self.session.execute(
                text(
                    "SELECT id, name, trigger_type, trigger_config, action_type, action_config"
                    " FROM automation_rules"
                    " WHERE organization_id = CAST(:oid AS uuid)"
                    " AND trigger_type = :ttype AND is_active = true"
                    " ORDER BY created_at ASC"
                ).bindparams(oid=org_id, ttype=trigger_type),
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def get_rule(self, org_id: str, rule_id: str) -> dict | None:
        row = (
            await self.session.execute(
                text(
                    "SELECT id, name, trigger_type, trigger_config, action_type, action_config,"
                    " is_active, created_by, created_at, updated_at"
                    " FROM automation_rules"
                    " WHERE id = CAST(:rid AS uuid) AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(rid=rule_id, oid=org_id),
            )
        ).mappings().first()
        return self._serialize(row) if row else None

    async def create_rule(
        self,
        org_id: str,
        *,
        name: str,
        trigger_type: str,
        trigger_config: dict[str, Any],
        action_type: str,
        action_config: dict[str, Any],
        is_active: bool,
        created_by: str,
    ) -> dict:
        validate_trigger_type(trigger_type)
        validate_action_type(action_type)
        rid = str(uuid.uuid4())
        await self.session.execute(
            text(
                "INSERT INTO automation_rules"
                " (id, organization_id, name, trigger_type, trigger_config, action_type,"
                " action_config, is_active, created_by)"
                " VALUES (CAST(:id AS uuid), CAST(:oid AS uuid), :name, :ttype,"
                " CAST(:tconf AS jsonb), :atype, CAST(:aconf AS jsonb), :active, CAST(:uid AS uuid))"
            ).bindparams(
                id=rid,
                oid=org_id,
                name=name,
                ttype=trigger_type,
                tconf=json.dumps(trigger_config or {}),
                atype=action_type,
                aconf=json.dumps(action_config or {}),
                active=is_active,
                uid=created_by,
            ),
        )
        await self.session.commit()
        rule = await self.get_rule(org_id, rid)
        assert rule is not None
        return rule

    async def update_rule(self, org_id: str, rule_id: str, patch: dict[str, Any]) -> dict:
        existing = await self.get_rule(org_id, rule_id)
        if not existing:
            raise ValueError("Règle introuvable")
        name = patch.get("name", existing["name"])
        trigger_type = patch.get("trigger_type", existing["trigger_type"])
        action_type = patch.get("action_type", existing["action_type"])
        validate_trigger_type(trigger_type)
        validate_action_type(action_type)
        trigger_config = patch.get("trigger_config", existing["trigger_config"])
        action_config = patch.get("action_config", existing["action_config"])
        is_active = patch.get("is_active", existing["is_active"])
        await self.session.execute(
            text(
                "UPDATE automation_rules SET name = :name, trigger_type = :ttype,"
                " trigger_config = CAST(:tconf AS jsonb), action_type = :atype,"
                " action_config = CAST(:aconf AS jsonb), is_active = :active, updated_at = now()"
                " WHERE id = CAST(:rid AS uuid) AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(
                rid=rule_id,
                oid=org_id,
                name=name,
                ttype=trigger_type,
                tconf=json.dumps(trigger_config or {}),
                atype=action_type,
                aconf=json.dumps(action_config or {}),
                active=is_active,
            ),
        )
        await self.session.commit()
        rule = await self.get_rule(org_id, rule_id)
        assert rule is not None
        return rule

    async def delete_rule(self, org_id: str, rule_id: str) -> bool:
        result = await self.session.execute(
            text(
                "DELETE FROM automation_rules WHERE id = CAST(:rid AS uuid)"
                " AND organization_id = CAST(:oid AS uuid) RETURNING id"
            ).bindparams(rid=rule_id, oid=org_id),
        )
        deleted = result.first() is not None
        if deleted:
            await self.session.commit()
        return deleted

    @staticmethod
    def _serialize(row: Any) -> dict:
        data = dict(row)
        data["id"] = str(data["id"])
        if data.get("created_by"):
            data["created_by"] = str(data["created_by"])
        for key in ("trigger_config", "action_config"):
            val = data.get(key)
            if isinstance(val, str):
                data[key] = json.loads(val)
            elif val is None:
                data[key] = {}
        for ts in ("created_at", "updated_at"):
            if data.get(ts):
                data[ts] = data[ts].isoformat()
        return data
