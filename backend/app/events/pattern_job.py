"""Pattern promotion — weekly memory compounding job."""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.embeddings import embed_text, vector_to_pg
from app.job_dedup import try_acquire_job_key


async def job_pattern_promotion(session: AsyncSession) -> int:
    """Find recurring episodic themes (3+ similar in 30 days) and promote to pattern memories."""
    orgs = (
        await session.execute(text("SELECT id FROM organizations"))
    ).scalars().all()
    promoted = 0

    for org_id in orgs:
        oid = str(org_id)
        week_key = f"pattern:{oid}"
        if not await try_acquire_job_key(session, "pattern_promotion", week_key):
            continue

        candidates = (
            await session.execute(
                text(
                    "SELECT id, note, embedding FROM memory_metadata"
                    " WHERE organization_id = CAST(:oid AS uuid)"
                    " AND type = 'episodic' AND embedding IS NOT NULL"
                    " AND created_at >= now() - INTERVAL '30 days'"
                    " ORDER BY created_at DESC LIMIT 200"
                ).bindparams(oid=oid),
            )
        ).mappings().all()

        seen: set[str] = set()
        for i, base in enumerate(candidates):
            if str(base["id"]) in seen:
                continue
            cluster = [base]
            for other in candidates[i + 1 :]:
                if str(other["id"]) in seen:
                    continue
                try:
                    sim_row = (
                        await session.execute(
                            text(
                                "SELECT 1 - (CAST(:a AS vector) <=> CAST(:b AS vector)) AS sim"
                            ).bindparams(a=base["embedding"], b=other["embedding"]),
                        )
                    ).scalar()
                    if sim_row and float(sim_row) >= 0.85:
                        cluster.append(other)
                except Exception:
                    continue
            if len(cluster) >= 3:
                for c in cluster:
                    seen.add(str(c["id"]))
                theme = cluster[0]["note"][:200]
                pattern_note = f"Motif récurrent ({len(cluster)} occurrences): {theme}"
                vector, _ = await embed_text(pattern_note)
                pid = str(uuid.uuid4())
                await session.execute(
                    text(
                        "INSERT INTO memory_metadata"
                        " (id, organization_id, type, entity_type, note, source_module, strength, embedding)"
                        " VALUES (CAST(:id AS uuid), CAST(:oid AS uuid), 'pattern', 'commitment', :note,"
                        " 'pattern_job', :str, CAST(:emb AS vector))"
                    ).bindparams(
                        id=pid,
                        oid=oid,
                        note=pattern_note,
                        str=len(cluster),
                        emb=vector_to_pg(vector),
                    ),
                )
                promoted += 1

    if promoted:
        await session.commit()
    return promoted
