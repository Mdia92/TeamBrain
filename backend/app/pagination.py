"""Cursor-based pagination helpers."""

from __future__ import annotations

import base64
import json
from typing import Any


def encode_cursor(values: dict[str, Any]) -> str:
    return base64.urlsafe_b64encode(json.dumps(values, default=str).encode()).decode()


def decode_cursor(cursor: str) -> dict[str, Any]:
    try:
        return json.loads(base64.urlsafe_b64decode(cursor.encode()))
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError("Invalid cursor") from exc


def paginate_response(
    rows: list[dict[str, Any]],
    *,
    limit: int,
    cursor_fields: list[str],
) -> dict[str, Any]:
    """Build standard cursor page from rows fetched with limit+1."""
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = encode_cursor({f: last.get(f) for f in cursor_fields})
    return {"items": items, "next_cursor": next_cursor, "has_more": has_more}


def cursor_clause(
    cursor: str | None,
    *,
    time_field: str = "created_at",
    id_field: str = "id",
) -> tuple[str, dict[str, Any]]:
    if not cursor:
        return "", {}
    c = decode_cursor(cursor)
    return (
        f" AND ({time_field}, {id_field}) < (CAST(:c_at AS timestamptz), CAST(:c_id AS uuid))",
        {"c_at": c.get("created_at", c.get(time_field)), "c_id": c["id"]},
    )


def paginate_rows(
    rows: list[dict[str, Any]],
    *,
    limit: int,
    cursor_fields: list[str],
) -> dict[str, Any]:
    """Alias for paginate_response."""
    return paginate_response(rows, limit=limit, cursor_fields=cursor_fields)
