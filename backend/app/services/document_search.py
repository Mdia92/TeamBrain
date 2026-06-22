"""Semantic document search — pgvector with ILIKE fallback."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.embeddings import embed_text, vector_to_pg

SIMILARITY_MIN = 0.0


async def search_documents_semantic(
    session: AsyncSession,
    org_id: str,
    query: str,
    *,
    limit: int = 20,
) -> list[dict[str, Any]]:
    vector, _ = await embed_text(query)
    try:
        rows = (
            await session.execute(
                text(
                    "SELECT id, title, ai_summary, file_url,"
                    " (1 - (embedding <=> CAST(:emb AS vector))) AS similarity_score"
                    " FROM documents"
                    " WHERE organization_id = CAST(:oid AS uuid) AND embedding IS NOT NULL"
                    " ORDER BY embedding <=> CAST(:emb AS vector) ASC LIMIT :lim"
                ).bindparams(oid=org_id, emb=vector_to_pg(vector), lim=limit),
            )
        ).mappings().all()
        if rows:
            return [dict(r) for r in rows]
    except Exception:
        pass

    rows = (
        await session.execute(
            text(
                "SELECT id, title, ai_summary, file_url FROM documents"
                " WHERE organization_id = CAST(:oid AS uuid)"
                " AND (title ILIKE :q OR ocr_text ILIKE :q OR ai_summary ILIKE :q)"
                " ORDER BY created_at DESC LIMIT :lim"
            ).bindparams(oid=org_id, q=f"%{query}%", lim=limit),
        )
    ).mappings().all()
    return [{**dict(r), "similarity_score": 0.5} for r in rows]


async def embed_document(session: AsyncSession, doc_id: str, text_content: str) -> None:
    vector, _ = await embed_text(text_content)
    await session.execute(
        text("UPDATE documents SET embedding = CAST(:emb AS vector) WHERE id = CAST(:did AS uuid)").bindparams(
            emb=vector_to_pg(vector), did=doc_id
        ),
    )
