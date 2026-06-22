"""Async database session — Supabase transaction pooler safe."""

from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings


def _prepared_statement_name_func() -> str:
    return f"__asyncpg_{uuid4()}__"


def _create_engine():
    url = settings.database_url or "sqlite+aiosqlite:///:memory:"
    connect_args = {}
    if url.startswith("postgresql"):
        connect_args = {
            "statement_cache_size": 0,
            "prepared_statement_name_func": _prepared_statement_name_func,
        }
    return create_async_engine(url, poolclass=NullPool, connect_args=connect_args)


engine = _create_engine()

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
