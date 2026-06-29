"""Voice note ingestion — transcribe, summarize, memory, search index."""

from __future__ import annotations

import uuid

from fastapi import UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text
from app.agents.memory_service import MemoryService
from app.automation import run_automation_event
from app.services.document_search import embed_document
from app.storage.s3 import get_storage
from app.upload_limits import read_upload_bounded
from app.workers.transcription import transcribe_audio


async def ingest_voice_note(
    session: AsyncSession,
    user: dict,
    *,
    content: bytes,
    filename: str,
    content_type: str | None,
    title: str,
    project_id: str | None = None,
) -> dict:
    doc_id = uuid.uuid4()
    oid = str(user["organization_id"])
    storage = get_storage()
    key = f"{oid}/documents/{doc_id}/{filename}"
    file_url = await storage.upload(key, content, content_type or "audio/webm")

    transcript = await transcribe_audio(content, filename, content_type)
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
            ctype=content_type or "audio/webm",
            size=len(content),
            ocr=transcript[:50000],
            summary=summary or None,
            uid=str(user["id"]),
        ),
    )
    brain = MemoryService(session)
    memory_note = summary or transcript[:500] or title
    await brain.write_memory(
        org_id=oid,
        type="semantic" if summary else "episodic",
        entity_type="document",
        entity_id=str(doc_id),
        note=f"Note vocale: {memory_note}",
        source_module="documents",
        source_id=str(doc_id),
    )
    await session.commit()

    text_for_embed = f"{title} {summary} {transcript[:2000]}"
    try:
        await embed_document(session, str(doc_id), text_for_embed)
        await session.commit()
    except Exception:
        pass

    await run_automation_event(
        session,
        org_id=oid,
        trigger_type="document_uploaded",
        context={
            "document_id": str(doc_id),
            "title": title,
            "project_id": project_id,
            "doc_type": "voice_note",
            "uploaded_by": str(user["id"]),
        },
    )

    return {
        "id": str(doc_id),
        "file_url": file_url,
        "doc_type": "voice_note",
        "transcript": transcript,
        "ai_summary": summary,
        "transcription_available": not transcript.startswith("["),
    }


async def read_upload_audio(audio: UploadFile) -> tuple[bytes, str, str | None]:
    content = await read_upload_bounded(audio)
    filename = audio.filename or "voice.webm"
    return content, filename, audio.content_type
