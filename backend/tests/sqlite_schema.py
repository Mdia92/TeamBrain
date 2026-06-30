"""Minimal SQLite schema for integration tests (CI has no Postgres)."""

from __future__ import annotations

import uuid

from sqlalchemy import text

from app.db.session import engine

DDL = """
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT DEFAULT 'free',
    settings TEXT DEFAULT '{}',
    language TEXT DEFAULT 'fr',
    owner_id TEXT,
    pricing_tier TEXT DEFAULT 'free_trial',
    trial_ends_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'member',
    password_hash TEXT,
    is_active INTEGER DEFAULT 1,
    onboarding_completed INTEGER DEFAULT 0,
    must_change_password INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS org_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    role TEXT NOT NULL,
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    UNIQUE(user_id, organization_id)
);
CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_direct INTEGER DEFAULT 0,
    created_by TEXT
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    last_used_ip TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    source TEXT DEFAULT 'manual',
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS memory_metadata (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    type TEXT,
    entity_type TEXT,
    entity_id TEXT,
    note TEXT,
    source_module TEXT,
    source_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS module_findings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    module TEXT NOT NULL,
    finding_type TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pending_actions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload TEXT DEFAULT '{}',
    suggested_by TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS org_notifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    link_path TEXT,
    read_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


async def bootstrap_sqlite(*, force: bool = False) -> None:
    from app.db.sql_compat import is_sqlite

    if not force and not is_sqlite():
        return
    async with engine.begin() as conn:
        for stmt in DDL.split(";"):
            s = stmt.strip()
            if s:
                await conn.execute(text(s))


def new_uuid() -> str:
    return str(uuid.uuid4())
