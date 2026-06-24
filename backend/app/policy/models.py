"""Policy field definitions and validation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

POLICY_KEYS = (
    "overdue_task_days",
    "commitment_reminder_hours_before",
    "field_report_gap_days",
    "memory_dedup_similarity",
    "memory_decay_months",
    "assistant_confidence_min",
    "auto_action_confidence_min",
)

POLICY_BOUNDS: dict[str, tuple[float, float]] = {
    "overdue_task_days": (0, 90),
    "commitment_reminder_hours_before": (1, 168),
    "field_report_gap_days": (1, 90),
    "memory_dedup_similarity": (0.5, 1.0),
    "memory_decay_months": (1, 36),
    "assistant_confidence_min": (0.1, 1.0),
    "auto_action_confidence_min": (0.1, 1.0),
}


@dataclass(frozen=True)
class OrgPolicy:
    overdue_task_days: int
    commitment_reminder_hours_before: int
    field_report_gap_days: int
    memory_dedup_similarity: float
    memory_decay_months: int
    assistant_confidence_min: float
    auto_action_confidence_min: float

    def as_dict(self) -> dict[str, float | int]:
        return {k: getattr(self, k) for k in POLICY_KEYS}

    @classmethod
    def from_mapping(cls, data: dict[str, Any]) -> OrgPolicy:
        return cls(
            overdue_task_days=int(data["overdue_task_days"]),
            commitment_reminder_hours_before=int(data["commitment_reminder_hours_before"]),
            field_report_gap_days=int(data["field_report_gap_days"]),
            memory_dedup_similarity=float(data["memory_dedup_similarity"]),
            memory_decay_months=int(data["memory_decay_months"]),
            assistant_confidence_min=float(data["assistant_confidence_min"]),
            auto_action_confidence_min=float(data["auto_action_confidence_min"]),
        )


def validate_policy_patch(patch: dict[str, Any]) -> dict[str, float | int]:
    """Return sanitized overrides; raises ValueError on unknown keys or out-of-range values."""
    cleaned: dict[str, float | int] = {}
    for key, value in patch.items():
        if key not in POLICY_KEYS:
            raise ValueError(f"Clé de politique inconnue: {key}")
        lo, hi = POLICY_BOUNDS[key]
        if key in ("memory_dedup_similarity", "assistant_confidence_min", "auto_action_confidence_min"):
            num = float(value)
        else:
            num = int(value)
        if num < lo or num > hi:
            raise ValueError(f"{key} doit être entre {lo} et {hi}")
        cleaned[key] = num
    return cleaned
