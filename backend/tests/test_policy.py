"""Policy service tests."""

from __future__ import annotations

import pytest

from app.policy.models import OrgPolicy, validate_policy_patch
from app.policy.service import load_default_policy, merge_policy


def test_default_policy_loads_all_keys():
    policy = load_default_policy()
    data = policy.as_dict()
    assert data["overdue_task_days"] == 2
    assert data["field_report_gap_days"] == 7
    assert data["memory_dedup_similarity"] == 0.92
    assert data["assistant_confidence_min"] == 0.6


def test_merge_policy_overrides():
    defaults = load_default_policy()
    merged = merge_policy(defaults, {"overdue_task_days": 5, "assistant_confidence_min": 0.75})
    assert merged.overdue_task_days == 5
    assert merged.assistant_confidence_min == 0.75
    assert merged.field_report_gap_days == defaults.field_report_gap_days


def test_validate_policy_patch_rejects_unknown_key():
    with pytest.raises(ValueError, match="inconnue"):
        validate_policy_patch({"unknown_key": 1})


def test_validate_policy_patch_rejects_out_of_range():
    with pytest.raises(ValueError, match="overdue_task_days"):
        validate_policy_patch({"overdue_task_days": 200})


@pytest.mark.asyncio
async def test_policy_service_effective_from_db():
    from unittest.mock import AsyncMock, MagicMock

    from app.policy.service import PolicyService

    result = MagicMock()
    result.mappings.return_value.first.return_value = {
        "settings": {"policy": {"overdue_task_days": 4}},
    }
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    svc = PolicyService(session)
    policy = await svc.get_effective_policy("11111111-1111-1111-1111-111111111111")
    assert policy.overdue_task_days == 4
    assert isinstance(policy, OrgPolicy)
