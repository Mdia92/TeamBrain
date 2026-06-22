"""Meeting intelligence API."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.meeting_extractor import extract_meeting_intelligence
from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.storage.s3 import get_storage
from app.workers.transcription import transcribe_audio

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.get("")
async def list_meetings(
    project_id: str | None = None,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    query = (
        "SELECT id, title, date, duration_minutes, ai_summary, platform_source,"
        " processing_status, project_id FROM meetings"
        " WHERE organization_id = CAST(:oid AS uuid)"
    )
    params = {"oid": str(user["organization_id"])}
    if project_id:
        query += " AND project_id = CAST(:pid AS uuid)"
        params["pid"] = project_id
    query += " ORDER BY date DESC"
    rows = (await session.execute(text(query).bindparams(**params))).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_meeting(
    title: str = Form(...),
    project_id: str | None = Form(None),
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    mid = uuid.uuid4()
    oid = str(user["organization_id"])
    audio_bytes = await audio.read()
    storage = get_storage()
    key = f"{oid}/meetings/{mid}/{audio.filename}"
    audio_url = await storage.upload(key, audio_bytes, audio.content_type)

    await session.execute(
        text(
            "INSERT INTO meetings (id, organization_id, project_id, title, date, audio_url,"
            " platform_source, processing_status, created_by)"
            " VALUES (CAST(:mid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title, now(),"
            " :url, 'in_person', 'processing', CAST(:uid AS uuid))"
        ).bindparams(
            mid=str(mid),
            oid=oid,
            pid=project_id,
            title=title,
            url=audio_url,
            uid=str(user["id"]),
        ),
    )
    await session.commit()

    transcript = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")
    extraction, model = await extract_meeting_intelligence(transcript)
    brain = MemoryService(session)

    await session.execute(
        text(
            "UPDATE meetings SET transcript_text = :t, ai_summary = :s,"
            " processing_status = 'completed' WHERE id = CAST(:mid AS uuid)"
        ).bindparams(t=transcript, s=extraction.summary, mid=str(mid)),
    )

    for decision in extraction.decisions:
        await session.execute(
            text(
                "INSERT INTO meeting_decisions (id, meeting_id, decision_text, logged_to_memory)"
                " VALUES (gen_random_uuid(), CAST(:mid AS uuid), :text, true)"
            ).bindparams(mid=str(mid), text=decision),
        )
        await brain.write_memory(
            org_id=oid,
            type="decision",
            entity_type="meeting",
            entity_id=str(mid),
            note=decision,
            source_module="meeting",
            source_id=str(mid),
        )

    created_tasks = []
    for item in extraction.action_items:
        tid = uuid.uuid4()
        assignee_row = None
        if item.assignee_name:
            assignee_row = (
                await session.execute(
                    text(
                        "SELECT id FROM users WHERE organization_id = CAST(:oid AS uuid)"
                        " AND full_name ILIKE :name LIMIT 1"
                    ).bindparams(oid=oid, name=f"%{item.assignee_name}%"),
                )
            ).first()

        await session.execute(
            text(
                "INSERT INTO tasks (id, organization_id, project_id, title, assignee_id, due_date,"
                " priority, status, source, source_reference, created_by)"
                " VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title,"
                " CAST(:aid AS uuid), CAST(:due AS date), 'medium', 'todo', 'meeting_ai', :ref,"
                " CAST(:uid AS uuid))"
            ).bindparams(
                tid=str(tid),
                oid=oid,
                pid=project_id,
                title=item.description,
                aid=str(assignee_row[0]) if assignee_row else None,
                due=item.due_date,
                ref=str(mid),
                uid=str(user["id"]),
            ),
        )
        await session.execute(
            text(
                "INSERT INTO meeting_action_items (id, meeting_id, task_id, description, assignee_id,"
                " due_date) VALUES (gen_random_uuid(), CAST(:mid AS uuid), CAST(:tid AS uuid),"
                " :desc, CAST(:aid AS uuid), CAST(:due AS date))"
            ).bindparams(
                mid=str(mid),
                tid=str(tid),
                desc=item.description,
                aid=str(assignee_row[0]) if assignee_row else None,
                due=item.due_date,
            ),
        )
        created_tasks.append(str(tid))
        await brain.write_memory(
            org_id=oid,
            type="episodic",
            entity_type="task",
            entity_id=str(tid),
            note=f"Task auto-created from meeting: {item.description}",
            source_module="meeting",
            source_id=str(mid),
        )

    for commitment in extraction.commitments:
        person = commitment.person_name or "groupe"
        deadline = commitment.deadline or "non précisé"
        await session.execute(
            text(
                "INSERT INTO meeting_commitments (id, meeting_id, commitment_text, deadline)"
                " VALUES (gen_random_uuid(), CAST(:mid AS uuid), :text, CAST(:due AS date))"
            ).bindparams(mid=str(mid), text=commitment.text, due=commitment.deadline),
        )
        await brain.write_memory(
            org_id=oid,
            type="commitment",
            entity_type="meeting",
            entity_id=str(mid),
            note=f"{commitment.text} — {person} by {deadline}",
            source_module="meeting",
            source_id=str(mid),
        )

    if project_id:
        channel = (
            await session.execute(
                text("SELECT id FROM channels WHERE project_id = CAST(:pid AS uuid) LIMIT 1").bindparams(
                    pid=project_id
                ),
            )
        ).first()
        if channel:
            task_lines = "\n".join(f"- {t}" for t in extraction.action_items[:10] if t.description)
            summary_msg = (
                f"Résumé réunion « {title} »:\n{extraction.summary}\n\n"
                f"Actions créées ({len(created_tasks)}):\n{task_lines or 'Aucune'}"
            )
            await session.execute(
                text(
                    "INSERT INTO messages (id, organization_id, channel_id, sender_id, content)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:cid AS uuid),"
                    " CAST(:uid AS uuid), :content)"
                ).bindparams(
                    oid=oid,
                    cid=str(channel[0]),
                    uid=str(user["id"]),
                    content=summary_msg,
                ),
            )

    await session.execute(
        text(
            "INSERT INTO agent_runs (id, organization_id, agent_type, input, output, model)"
            " VALUES (gen_random_uuid(), CAST(:oid AS uuid), 'meeting_extractor',"
            " CAST(:inp AS jsonb), CAST(:out AS jsonb), :model)"
        ).bindparams(
            oid=oid,
            inp=json.dumps({"meeting_id": str(mid)}),
            out=extraction.model_dump_json(),
            model=model,
        ),
    )
    await session.commit()

    return {
        "id": str(mid),
        "summary": extraction.summary,
        "tasks_created": created_tasks,
        "decisions": extraction.decisions,
        "open_questions": extraction.open_questions,
    }


@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    meeting = (
        (
            await session.execute(
                text("SELECT * FROM meetings WHERE id = CAST(:mid AS uuid)").bindparams(mid=meeting_id),
            )
        )
        .mappings()
        .first()
    )
    decisions = (
        await session.execute(
            text("SELECT * FROM meeting_decisions WHERE meeting_id = CAST(:mid AS uuid)").bindparams(
                mid=meeting_id
            ),
        )
    ).mappings().all()
    actions = (
        await session.execute(
            text("SELECT * FROM meeting_action_items WHERE meeting_id = CAST(:mid AS uuid)").bindparams(
                mid=meeting_id
            ),
        )
    ).mappings().all()
    commitments = (
        await session.execute(
            text("SELECT * FROM meeting_commitments WHERE meeting_id = CAST(:mid AS uuid)").bindparams(
                mid=meeting_id
            ),
        )
    ).mappings().all()
    return {
        "meeting": dict(meeting) if meeting else None,
        "decisions": [dict(d) for d in decisions],
        "action_items": [dict(a) for a in actions],
        "commitments": [dict(c) for c in commitments],
    }
