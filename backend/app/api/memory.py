"""Organizational memory API — timeline, patterns, search."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.pagination import decode_cursor, encode_cursor

router = APIRouter(prefix="/api/memory", tags=["memory"])


class SearchIn(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, le=50)


@router.get("")
async def list_memories(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    cursor: str | None = None,
    limit: int = Query(default=30, le=100),
    type_filter: str | None = None,
) -> dict:
    params: dict = {"oid": str(user["organization_id"]), "lim": limit + 1}
    type_clause = ""
    cursor_clause = ""
    if type_filter:
        type_clause = " AND type = :tfilter"
        params["tfilter"] = type_filter
    if cursor:
        c = decode_cursor(cursor)
        cursor_clause = " AND (created_at, id) < (CAST(:c_at AS timestamptz), CAST(:c_id AS uuid))"
        params["c_at"] = c["created_at"]
        params["c_id"] = c["id"]

    rows = (
        await session.execute(
            text(
                "SELECT id, type, entity_type, entity_id::text, note, source_module,"
                " source_id::text, strength, created_at, last_reinforced_at"
                " FROM memory_metadata"
                " WHERE organization_id = CAST(:oid AS uuid)"
                f"{type_clause}{cursor_clause}"
                " ORDER BY created_at DESC, id DESC LIMIT :lim"
            ).bindparams(**params),
        )
    ).mappings().all()
    items = [dict(r) for r in rows[:limit]]
    next_cursor = None
    if len(rows) > limit and items:
        last = items[-1]
        next_cursor = encode_cursor({"created_at": str(last["created_at"]), "id": str(last["id"])})
    return {"items": items, "next_cursor": next_cursor, "has_more": len(rows) > limit}


@router.get("/patterns")
async def list_patterns(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT id, note, strength, created_at, last_reinforced_at"
                " FROM memory_metadata"
                " WHERE organization_id = CAST(:oid AS uuid) AND type = 'pattern'"
                " AND resolved_at IS NULL ORDER BY strength DESC, created_at DESC LIMIT 20"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.get("/projects-summary")
async def projects_summary(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT p.id, p.name, COUNT(m.id) AS memory_count,"
                " MAX(m.created_at) AS last_memory_at"
                " FROM projects p"
                " LEFT JOIN memory_metadata m ON m.organization_id = p.organization_id"
                " AND m.entity_type = 'task'"
                " AND m.entity_id IN (SELECT id FROM tasks WHERE project_id = p.id)"
                " WHERE p.organization_id = CAST(:oid AS uuid)"
                " GROUP BY p.id, p.name ORDER BY memory_count DESC"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("/search")
async def search_memories(
    body: SearchIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    brain = MemoryService(session)
    hits = await brain.search_memory(str(user["organization_id"]), body.query, limit=body.limit)
    return {
        "items": [
            {
                "id": h.id,
                "type": h.type,
                "note": h.note,
                "similarity_score": h.similarity_score,
                "source_module": h.source_module,
            }
            for h in hits
        ],
    }
