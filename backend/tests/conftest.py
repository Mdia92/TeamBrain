"""Pytest fixtures — SQLite in-memory DB for CI."""

from __future__ import annotations

import asyncio
import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Must run before app imports so the engine uses SQLite in CI.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-minimum-32-characters-long"


def _reset_test_engine() -> None:
    from app.config import get_settings
    from app.db import session as db_session

    get_settings.cache_clear()
    db_session.engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    db_session.SessionLocal = async_sessionmaker(
        bind=db_session.engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


@pytest.fixture(scope="session")
def _init_sqlite_schema() -> None:
    _reset_test_engine()
    from sqlite_schema import bootstrap_sqlite

    asyncio.run(bootstrap_sqlite(force=True))


@pytest.fixture(autouse=True)
def _sqlite_test_db(_init_sqlite_schema) -> None:
    from app.db.session import engine

    async def _truncate() -> None:
        async with engine.begin() as conn:
            for table in (
                "pending_actions",
                "module_findings",
                "memory_metadata",
                "tasks",
                "projects",
                "refresh_tokens",
                "channels",
                "org_memberships",
                "users",
                "organizations",
            ):
                await conn.execute(text(f"DELETE FROM {table}"))

    asyncio.run(_truncate())
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> None:
    from app.rate_limit import limiter

    storage = getattr(limiter, "_storage", None)
    if storage is not None and hasattr(storage, "storage"):
        storage.storage.clear()
    yield
    if storage is not None and hasattr(storage, "storage"):
        storage.storage.clear()
