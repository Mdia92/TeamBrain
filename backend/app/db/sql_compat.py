"""Dialect helpers for SQLite (pytest) vs PostgreSQL (production)."""

from __future__ import annotations

from app.config import settings


def database_url() -> str:
    return settings.database_url or "sqlite+aiosqlite:///:memory:"


def is_sqlite() -> bool:
    return database_url().startswith("sqlite")


def settings_column() -> str:
    return ":settings" if is_sqlite() else "CAST(:settings AS jsonb)"


def trial_ends_sql() -> str:
    if is_sqlite():
        return "datetime('now', '+30 days')"
    return "now() + INTERVAL '30 days'"


def now_sql() -> str:
    return "datetime('now')" if is_sqlite() else "now()"

