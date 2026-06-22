"""Idempotent background job deduplication."""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def try_acquire_job_key(session: AsyncSession, job_name: str, dedup_key: str) -> bool:
    """Return True if this job+key has not run yet (insert succeeds)."""
    try:
        await session.execute(
            text(
                "INSERT INTO job_dedup_keys (id, job_name, dedup_key)"
                " VALUES (CAST(:id AS uuid), :job, :key)"
            ).bindparams(id=str(uuid.uuid4()), job=job_name, key=dedup_key),
        )
        return True
    except Exception:
        await session.rollback()
        return False
