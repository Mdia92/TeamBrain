"""Documents API — upload, summarize, search."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.pagination import cursor_clause, paginate_response
from app.services.document_search import embed_document, search_documents_semantic
from app.storage.s3 import get_storage
from app.trial import require_write_access

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
async def list_documents(
    project_id: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    cc, cparams = cursor_clause(cursor)
    query = (
        "SELECT id, title, file_url, content_type, file_size, tags, ai_summary, project_id, created_at"
        " FROM documents WHERE organization_id = CAST(:oid AS uuid)"
    )
    params: dict = {"oid": str(user["organization_id"]), "lim": limit + 1, **cparams}
    if project_id:
        query += " AND project_id = CAST(:pid AS uuid)"
        params["pid"] = project_id
    query += f"{cc} ORDER BY created_at DESC, id DESC LIMIT :lim"
    rows = [dict(r) for r in (await session.execute(text(query).bindparams(**params))).mappings().all()]
    return paginate_response(rows, limit=limit, cursor_fields=["created_at", "id"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    project_id: str | None = Form(None),
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    doc_id = uuid.uuid4()
    content = await file.read()
    storage = get_storage()
    key = f"{user['organization_id']}/documents/{doc_id}/{file.filename}"
    file_url = await storage.upload(key, content, file.content_type)
    oid = str(user["organization_id"])

    await session.execute(
        text(
            "INSERT INTO documents (id, organization_id, project_id, title, file_url,"
            " content_type, file_size, uploaded_by)"
            " VALUES (CAST(:did AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, :url,"
            " :ctype, :size, CAST(:uid AS uuid))"
        ).bindparams(
            did=str(doc_id),
            oid=oid,
            pid=project_id,
            title=title,
            url=file_url,
            ctype=file.content_type,
            size=len(content),
            uid=str(user["id"]),
        ),
    )

    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="document",
        entity_id=str(doc_id),
        note=f"Document ajouté: {title}",
        source_module="documents",
        source_id=str(doc_id),
    )
    await session.commit()

    text_for_embed = f"{title} {file.filename or ''}"
    try:
        await embed_document(session, str(doc_id), text_for_embed)
        await session.commit()
    except Exception:
        pass

    return {"id": str(doc_id), "file_url": file_url}


@router.post("/{doc_id}/summarize")
async def summarize_document(
    doc_id: str,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    row = (
        (
            await session.execute(
                text(
                    "SELECT title, ocr_text FROM documents WHERE id = CAST(:did AS uuid)"
                    " AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(did=doc_id, oid=str(user["organization_id"])),
            )
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")

    text_content = row["ocr_text"] or row["title"]
    summary, model = await generate_text(
        f"Résume ce document en français (3-5 phrases structurées):\n\n{text_content[:8000]}",
        "Tu es un assistant documentaire.",
    )
    await session.execute(
        text("UPDATE documents SET ai_summary = :s WHERE id = CAST(:did AS uuid)").bindparams(
            s=summary, did=doc_id
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=str(user["organization_id"]),
        type="semantic",
        entity_type="document",
        entity_id=doc_id,
        note=summary[:4000],
        source_module="documents",
        source_id=doc_id,
    )
    try:
        await embed_document(session, doc_id, f"{row['title']} {summary}")
    except Exception:
        pass
    await session.commit()
    return {"summary": summary, "model": model}


@router.get("/search")
async def search_documents(
    q: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    items = await search_documents_semantic(session, str(user["organization_id"]), q, limit=20)
    return {"items": items, "query": q}
