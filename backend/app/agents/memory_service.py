"""Unified Team Brain — single read/write path for organizational memory."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.embeddings import embed_text, vector_to_pg

MemoryType = str  # episodic|semantic|commitment|decision|relationship
EntityType = str  # task|meeting|field_report|message|document|commitment


@dataclass
class MemoryHit:
    id: str
    type: str
    entity_type: str | None
    entity_id: str | None
    note: str | None
    source_module: str | None
    source_id: str | None
    similarity_score: float


class MemoryService:
    """One write path and one read path for all modules."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def write_memory(
        self,
        *,
        org_id: str,
        type: MemoryType,
        entity_type: EntityType,
        entity_id: str | None,
        note: str,
        source_module: str,
        source_id: str | None = None,
    ) -> str:
        memory_id = str(uuid.uuid4())
        await self.session.execute(
            text(
                "INSERT INTO memory_metadata"
                " (id, organization_id, type, entity_type, entity_id, note,"
                " source_module, source_id)"
                " VALUES (CAST(:id AS uuid), CAST(:oid AS uuid), :type, :etype,"
                " CAST(:eid AS uuid), :note, :smod, CAST(:sid AS uuid))"
            ).bindparams(
                id=memory_id,
                oid=org_id,
                type=type,
                etype=entity_type,
                eid=entity_id,
                note=note,
                smod=source_module,
                sid=source_id,
            ),
        )

        try:
            vector, _ = await embed_text(note)
            await self.session.execute(
                text(
                    "UPDATE memory_metadata SET embedding = CAST(:emb AS vector)"
                    " WHERE id = CAST(:id AS uuid)"
                ).bindparams(id=memory_id, emb=vector_to_pg(vector)),
            )
        except Exception:
            pass  # never block on embedding failure

        return memory_id

    async def search_memory(
        self,
        org_id: str,
        query_text: str,
        limit: int = 10,
        type_filter: str | None = None,
    ) -> list[MemoryHit]:
        vector, _ = await embed_text(query_text)
        type_clause = " AND type = :tfilter" if type_filter else ""
        params: dict[str, Any] = {
            "oid": org_id,
            "emb": vector_to_pg(vector),
            "lim": limit,
        }
        if type_filter:
            params["tfilter"] = type_filter

        try:
            rows = (
                await self.session.execute(
                    text(
                        "SELECT id, type, entity_type, entity_id::text, note,"
                        " source_module, source_id::text,"
                        " 1 - (embedding <=> CAST(:emb AS vector)) AS similarity"
                        " FROM memory_metadata"
                        " WHERE organization_id = CAST(:oid AS uuid)"
                        " AND embedding IS NOT NULL"
                        f"{type_clause}"
                        " ORDER BY embedding <=> CAST(:emb AS vector)"
                        " LIMIT :lim"
                    ).bindparams(**params),
                )
            ).mappings().all()
            if rows:
                return [
                    MemoryHit(
                        id=str(r["id"]),
                        type=r["type"],
                        entity_type=r["entity_type"],
                        entity_id=r["entity_id"],
                        note=r["note"],
                        source_module=r["source_module"],
                        source_id=r["source_id"],
                        similarity_score=float(r["similarity"] or 0),
                    )
                    for r in rows
                ]
        except Exception:
            pass  # pgvector unavailable — fall through to ILIKE

        ilike_params: dict[str, Any] = {
            "oid": org_id,
            "q": f"%{query_text[:100]}%",
            "lim": limit,
        }
        ilike_type = " AND type = :tfilter" if type_filter else ""
        if type_filter:
            ilike_params["tfilter"] = type_filter

        rows = (
            await self.session.execute(
                text(
                    "SELECT id, type, entity_type, entity_id::text, note,"
                    " source_module, source_id::text"
                    " FROM memory_metadata"
                    " WHERE organization_id = CAST(:oid AS uuid)"
                    " AND note ILIKE :q"
                    f"{ilike_type}"
                    " ORDER BY created_at DESC LIMIT :lim"
                ).bindparams(**ilike_params),
            )
        ).mappings().all()

        return [
            MemoryHit(
                id=str(r["id"]),
                type=r["type"],
                entity_type=r["entity_type"],
                entity_id=r["entity_id"],
                note=r["note"],
                source_module=r["source_module"],
                source_id=r["source_id"],
                similarity_score=0.5,
            )
            for r in rows
        ]

    async def get_who_owes_what(self, org_id: str) -> list[dict]:
        """Pure SQL accountability view grouped by person."""
        today = date.today()
        soon = today + timedelta(days=3)

        open_tasks = (
            await self.session.execute(
                text(
                    "SELECT u.id AS user_id, u.full_name, t.id AS item_id, t.title,"
                    " t.due_date, t.priority, 'task' AS source, t.id::text AS source_id"
                    " FROM tasks t"
                    " JOIN users u ON u.id = t.assignee_id"
                    " WHERE t.organization_id = CAST(:oid AS uuid)"
                    " AND t.status != 'done' AND t.assignee_id IS NOT NULL"
                ).bindparams(oid=org_id),
            )
        ).mappings().all()

        commitments = (
            await self.session.execute(
                text(
                    "SELECT u.id AS user_id, u.full_name, mc.id AS item_id,"
                    " mc.commitment_text AS title, mc.deadline AS due_date,"
                    " 'commitment' AS source, mc.meeting_id::text AS source_id"
                    " FROM meeting_commitments mc"
                    " JOIN meetings m ON m.id = mc.meeting_id"
                    " LEFT JOIN users u ON u.id = mc.committed_by"
                    " WHERE m.organization_id = CAST(:oid AS uuid)"
                    " AND mc.is_fulfilled = false"
                    " AND (mc.deadline <= :soon OR mc.deadline < CURRENT_DATE)"
                ).bindparams(oid=org_id, soon=soon),
            )
        ).mappings().all()

        open_actions = (
            await self.session.execute(
                text(
                    "SELECT u.id AS user_id, u.full_name, mai.id AS item_id,"
                    " mai.description AS title, mai.due_date,"
                    " 'meeting_action' AS source, mai.meeting_id::text AS source_id"
                    " FROM meeting_action_items mai"
                    " JOIN meetings m ON m.id = mai.meeting_id"
                    " LEFT JOIN users u ON u.id = mai.assignee_id"
                    " LEFT JOIN tasks t ON t.id = mai.task_id"
                    " WHERE m.organization_id = CAST(:oid AS uuid)"
                    " AND (t.id IS NULL OR t.status != 'done')"
                ).bindparams(oid=org_id),
            )
        ).mappings().all()

        grouped: dict[str, dict] = {}

        def _severity(due: date | None) -> str:
            if due is None:
                return "medium"
            if due < today:
                return "urgent"
            if due <= soon:
                return "high"
            return "medium"

        for row in list(open_tasks) + list(commitments) + list(open_actions):
            uid = str(row["user_id"]) if row["user_id"] else "unassigned"
            if uid not in grouped:
                grouped[uid] = {
                    "user_id": uid,
                    "full_name": row["full_name"] or "Non assigné",
                    "items": [],
                }
            grouped[uid]["items"].append(
                {
                    "title": row["title"],
                    "due_date": str(row["due_date"]) if row["due_date"] else None,
                    "source": row["source"],
                    "source_id": row["source_id"],
                    "severity": _severity(row["due_date"]),
                }
            )

        return list(grouped.values())

    async def hydrate_memory(self, hit: MemoryHit) -> dict:
        """Fetch source record detail for a memory hit."""
        detail: dict[str, Any] = {"memory": hit.__dict__}
        if not hit.entity_type or not hit.entity_id:
            return detail

        table_map = {
            "task": ("tasks", "title, status, due_date::text, description"),
            "meeting": ("meetings", "title, ai_summary, date::text"),
            "field_report": ("field_reports", "location_name, mission_date::text, ai_summary, description"),
            "document": ("documents", "title, ai_summary"),
            "message": ("messages", "content, created_at::text"),
        }
        mapping = table_map.get(hit.entity_type)
        if not mapping:
            return detail

        table, cols = mapping
        row = (
            await self.session.execute(
                text(f"SELECT {cols} FROM {table} WHERE id = CAST(:id AS uuid)").bindparams(
                    id=hit.entity_id
                ),
            )
        ).mappings().first()
        if row:
            detail["source_detail"] = dict(row)
        return detail
