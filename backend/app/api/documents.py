"""Documents API — unified module (files, field reports, meeting notes)."""

from __future__ import annotations

import json
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.pagination import cursor_clause, paginate_response
from app.services.document_extract import (
    classify_doc_type,
    detect_format,
    extract_text_from_bytes,
    parse_tags_from_text,
)
from app.services.document_search import embed_document, search_documents_semantic
from app.storage.s3 import get_storage
from app.trial import require_write_access

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOC_TYPE_FILTER = ("document", "field_report", "meeting_notes", "voice_note")


class FieldReportIn(BaseModel):
    project_id: str | None = None
    mission_date: date
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    description: str | None = None
    photos: list[str] = Field(default_factory=list)
    client_id: str | None = None


def _doc_select() -> str:
    return (
        "SELECT id, title, file_url, content_type, file_size, tags, ai_summary, project_id, created_at,"
        " doc_type, gps_latitude, gps_longitude, location_name, mission_date::text AS mission_date,"
        " ocr_text, text_tags, synced_at"
    )


@router.get("")
async def list_documents(
    project_id: str | None = None,
    doc_type: str | None = Query(None, alias="type"),
    cursor: str | None = None,
    limit: int = Query(default=50, le=100),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    cc, cparams = cursor_clause(cursor)
    query = f"{_doc_select()} FROM documents WHERE organization_id = CAST(:oid AS uuid)"
    params: dict = {"oid": str(user["organization_id"]), "lim": limit + 1, **cparams}
    if project_id:
        query += " AND project_id = CAST(:pid AS uuid)"
        params["pid"] = project_id
    if doc_type and doc_type != "all":
        query += " AND doc_type = :dtype"
        params["dtype"] = doc_type
    query += f"{cc} ORDER BY created_at DESC, id DESC LIMIT :lim"
    rows = [dict(r) for r in (await session.execute(text(query).bindparams(**params))).mappings().all()]
    return paginate_response(rows, limit=limit, cursor_fields=["created_at", "id"])


@router.get("/map")
async def map_field_reports(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT id, location_name, gps_latitude AS latitude, gps_longitude AS longitude,"
                " mission_date::text AS mission_date, doc_type AS report_type"
                " FROM documents WHERE organization_id = CAST(:oid AS uuid)"
                " AND doc_type = 'field_report'"
                " AND gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"points": [dict(r) for r in rows]}


@router.post("/field-report", status_code=status.HTTP_201_CREATED)
async def create_field_report(
    body: FieldReportIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await _insert_field_report(session, user, body)


async def _insert_field_report(session: AsyncSession, user: dict, body: FieldReportIn) -> dict:
    did = uuid.uuid4()
    oid = str(user["organization_id"])
    summary = ""
    if body.description:
        summary, _ = await generate_text(
            f"Résume en 3 phrases ce rapport terrain:\n{body.description}",
            "Assistant terrain.",
        )
    title = body.location_name or "Rapport terrain"
    await session.execute(
        text(
            "INSERT INTO documents (id, organization_id, project_id, title, file_url, content_type,"
            " file_size, ocr_text, tags, ai_summary, uploaded_by, doc_type, gps_latitude, gps_longitude,"
            " location_name, mission_date, synced_at, submitted_by)"
            " VALUES (CAST(:did AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title,"
            " :url, 'text/plain', 0, :desc, CAST(:photos AS jsonb), :summary, CAST(:uid AS uuid),"
            " 'field_report', :lat, :lng, :loc, :mdate, now(), CAST(:uid AS uuid))"
        ).bindparams(
            did=str(did),
            oid=oid,
            pid=body.project_id,
            title=title,
            url=f"inline://field-report/{did}",
            desc=body.description,
            photos=json.dumps(body.photos),
            summary=summary,
            uid=str(user["id"]),
            lat=body.latitude,
            lng=body.longitude,
            loc=body.location_name,
            mdate=body.mission_date,
        ),
    )
    note = f"{summary or body.description or title} [{body.location_name or 'terrain'}]"
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="document",
        entity_id=str(did),
        note=note,
        source_module="documents",
        source_id=str(did),
    )
    await session.commit()
    return {"id": str(did), "ai_summary": summary}


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    project_id: str | None = Form(None),
    doc_type: str | None = Form(None),
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    doc_id = uuid.uuid4()
    content = await file.read()
    filename = file.filename or "document"
    fmt = detect_format(filename, file.content_type)
    if fmt == "unknown":
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Format de fichier non supporté — utilisez PDF, Word, Excel, PowerPoint, texte ou image",
        )
    storage = get_storage()
    key = f"{user['organization_id']}/documents/{doc_id}/{filename}"
    file_url = await storage.upload(key, content, file.content_type)
    oid = str(user["organization_id"])

    extracted = await extract_text_from_bytes(content, filename, file.content_type)
    resolved_type = doc_type or classify_doc_type(filename, extracted)
    if resolved_type not in DOC_TYPE_FILTER:
        resolved_type = "document"
    text_tags = parse_tags_from_text(extracted)

    summary = ""
    if extracted:
        summary, _ = await generate_text(
            f"Résume ce document en français (3-5 phrases):\n\n{extracted[:8000]}",
            "Tu es un assistant documentaire TeamBrain.",
        )

    await session.execute(
        text(
            "INSERT INTO documents (id, organization_id, project_id, title, file_url,"
            " content_type, file_size, ocr_text, ai_summary, uploaded_by, doc_type, text_tags)"
            " VALUES (CAST(:did AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, :url,"
            " :ctype, :size, :ocr, :summary, CAST(:uid AS uuid), :dtype, :ttags)"
        ).bindparams(
            did=str(doc_id),
            oid=oid,
            pid=project_id,
            title=title,
            url=file_url,
            ctype=file.content_type,
            size=len(content),
            ocr=extracted[:50000] if extracted else None,
            summary=summary or None,
            uid=str(user["id"]),
            dtype=resolved_type,
            ttags=text_tags or None,
        ),
    )

    brain = MemoryService(session)
    memory_note = summary or f"Document ajouté: {title} ({detect_format(filename, file.content_type)})"
    await brain.write_memory(
        org_id=oid,
        type="semantic" if summary else "episodic",
        entity_type="document",
        entity_id=str(doc_id),
        note=memory_note[:4000],
        source_module="documents",
        source_id=str(doc_id),
    )
    await session.commit()

    text_for_embed = f"{title} {summary} {extracted[:2000]}"
    try:
        await embed_document(session, str(doc_id), text_for_embed)
        await session.commit()
    except Exception:
        pass

    return {"id": str(doc_id), "file_url": file_url, "doc_type": resolved_type, "ai_summary": summary}


@router.post("/voice-note", status_code=status.HTTP_201_CREATED)
async def upload_voice_note(
    audio: UploadFile = File(...),
    title: str = Form("Note vocale"),
    project_id: str | None = Form(None),
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    from app.workers.transcription import transcribe_audio

    content = await audio.read()
    filename = audio.filename or "voice.webm"
    doc_id = uuid.uuid4()
    oid = str(user["organization_id"])
    storage = get_storage()
    key = f"{oid}/documents/{doc_id}/{filename}"
    file_url = await storage.upload(key, content, audio.content_type or "audio/webm")

    transcript = await transcribe_audio(content, filename)
    summary = ""
    if transcript and not transcript.startswith("["):
        summary, _ = await generate_text(
            f"Résume cette note vocale en 2-3 phrases:\n\n{transcript[:6000]}",
            "Assistant TeamBrain.",
        )

    await session.execute(
        text(
            "INSERT INTO documents (id, organization_id, project_id, title, file_url,"
            " content_type, file_size, ocr_text, ai_summary, uploaded_by, doc_type, submitted_by)"
            " VALUES (CAST(:did AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, :url,"
            " :ctype, :size, :ocr, :summary, CAST(:uid AS uuid), 'voice_note', CAST(:uid AS uuid))"
        ).bindparams(
            did=str(doc_id),
            oid=oid,
            pid=project_id,
            title=title,
            url=file_url,
            ctype=audio.content_type or "audio/webm",
            size=len(content),
            ocr=transcript[:50000],
            summary=summary or None,
            uid=str(user["id"]),
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="document",
        entity_id=str(doc_id),
        note=summary or transcript[:500] or title,
        source_module="documents",
        source_id=str(doc_id),
    )
    await session.commit()
    return {
        "id": str(doc_id),
        "file_url": file_url,
        "doc_type": "voice_note",
        "transcript": transcript,
        "ai_summary": summary,
    }


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
