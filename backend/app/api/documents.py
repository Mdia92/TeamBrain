"""Documents API — upload, summarize, search."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.storage.s3 import get_storage

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
async def list_documents(
    project_id: str | None = None,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    query = (
        "SELECT id, title, file_url, content_type, file_size, tags, ai_summary, project_id, created_at"
        " FROM documents WHERE organization_id = CAST(:oid AS uuid)"
    )
    params = {"oid": str(user["organization_id"])}
    if project_id:
        query += " AND project_id = CAST(:pid AS uuid)"
        params["pid"] = project_id
    query += " ORDER BY created_at DESC"
    rows = (await session.execute(text(query).bindparams(**params))).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    project_id: str | None = Form(None),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    doc_id = uuid.uuid4()
    content = await file.read()
    storage = get_storage()
    key = f"{user['organization_id']}/documents/{doc_id}/{file.filename}"
    file_url = await storage.upload(key, content, file.content_type)

    await session.execute(
        text(
            "INSERT INTO documents (id, organization_id, project_id, title, file_url,"
            " content_type, file_size, uploaded_by)"
            " VALUES (CAST(:did AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, :url,"
            " :ctype, :size, CAST(:uid AS uuid))"
        ).bindparams(
            did=str(doc_id),
            oid=str(user["organization_id"]),
            pid=project_id,
            title=title,
            url=file_url,
            ctype=file.content_type,
            size=len(content),
            uid=str(user["id"]),
        ),
    )
    await session.commit()
    return {"id": str(doc_id), "file_url": file_url}


@router.post("/{doc_id}/summarize")
async def summarize_document(
    doc_id: str,
    user: dict = Depends(get_current_user),
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
    await session.commit()
    return {"summary": summary, "model": model}


@router.get("/search")
async def search_documents(
    q: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT id, title, ai_summary, file_url FROM documents"
                " WHERE organization_id = CAST(:oid AS uuid)"
                " AND (title ILIKE :q OR ocr_text ILIKE :q OR ai_summary ILIKE :q)"
                " ORDER BY created_at DESC LIMIT 20"
            ).bindparams(oid=str(user["organization_id"]), q=f"%{q}%"),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "query": q}
