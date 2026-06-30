"""Inbox-style messaging API."""

from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.pagination import cursor_clause, paginate_response
from app.services.voice_notes import ingest_voice_note, read_upload_audio
from app.trial import require_write_access

router = APIRouter(prefix="/api/messages", tags=["messages"])

_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)


async def _assert_channel_in_org(
    session: AsyncSession, channel_id: str, org_id: str
) -> str:
    row = (
        await session.execute(
            text(
                "SELECT name FROM channels WHERE id = CAST(:cid AS uuid)"
                " AND organization_id = CAST(:oid AS uuid)"
            ).bindparams(cid=channel_id, oid=org_id),
        )
    ).first()
    if not row:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Canal inaccessible")
    return row[0]
ADMIN_ROLES = frozenset({"owner", "admin"})


class MessageIn(BaseModel):
    channel_id: str
    content: str = Field(min_length=1)
    thread_parent_id: str | None = None


class SendIn(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    recipient_ids: list[str] | None = None
    broadcast: bool = False
    category: str = Field(default="info", pattern="^(info|urgent|event)$")


def _is_admin(user: dict) -> bool:
    return user.get("role") in ADMIN_ROLES


def _inbox_visibility_clause() -> str:
    return (
        " AND m.channel_id IS NULL"
        " AND (m.sender_id = CAST(:uid AS uuid)"
        " OR m.recipient_ids IS NULL"
        " OR CAST(:uid AS uuid) = ANY(m.recipient_ids))"
    )


@router.get("/recipients")
async def list_recipients(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT u.id, u.full_name, u.email, om.role"
                " FROM org_memberships om"
                " JOIN users u ON u.id = om.user_id"
                " WHERE om.organization_id = CAST(:oid AS uuid) AND om.is_active = true"
                " ORDER BY u.full_name"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "can_broadcast": _is_admin(user)}


@router.get("/inbox")
async def inbox_list(
    filter: str = Query(default="all", pattern="^(all|unread|sent)$"),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    uid = str(user["id"])
    oid = str(user["organization_id"])
    extra = ""
    if filter == "unread":
        extra = (
            " AND NOT EXISTS (SELECT 1 FROM message_reads mr"
            " WHERE mr.message_id = m.id AND mr.user_id = CAST(:uid AS uuid))"
            " AND m.sender_id != CAST(:uid AS uuid)"
        )
    elif filter == "sent":
        extra = " AND m.sender_id = CAST(:uid AS uuid)"

    rows = (
        await session.execute(
            text(
                "SELECT m.id, m.subject, m.content, m.sender_id, m.recipient_ids,"
                " m.created_at, u.full_name AS sender_name,"
                " EXISTS (SELECT 1 FROM message_reads mr"
                "   WHERE mr.message_id = m.id AND mr.user_id = CAST(:uid AS uuid)) AS is_read"
                " FROM messages m"
                " JOIN users u ON u.id = m.sender_id"
                " WHERE m.organization_id = CAST(:oid AS uuid)"
                " AND m.thread_parent_id IS NULL"
                f"{_inbox_visibility_clause()}{extra}"
                " ORDER BY m.created_at DESC LIMIT 100"
            ).bindparams(uid=uid, oid=oid),
        )
    ).mappings().all()

    items = []
    for r in rows:
        item = dict(r)
        item["preview"] = (item.get("content") or "")[:120]
        item["is_unread"] = not item["is_read"] and str(item["sender_id"]) != uid
        items.append(item)
    return {"items": items}


@router.get("/announcements")
async def list_announcements(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Team-wide broadcast announcements (megaphone feed)."""
    oid = str(user["organization_id"])
    rows = (
        await session.execute(
            text(
                "SELECT m.id, m.subject, m.content, m.category, m.created_at,"
                " u.full_name AS sender_name, om.role AS sender_role"
                " FROM messages m"
                " JOIN users u ON u.id = m.sender_id"
                " JOIN org_memberships om ON om.user_id = u.id"
                "  AND om.organization_id = m.organization_id AND om.is_active = true"
                " WHERE m.organization_id = CAST(:oid AS uuid)"
                " AND m.thread_parent_id IS NULL"
                " AND m.recipient_ids IS NULL"
                " ORDER BY m.created_at DESC LIMIT 100"
            ).bindparams(oid=oid),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "can_publish": _is_admin(user)}


@router.get("/inbox/{message_id}")
async def inbox_thread(
    message_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    uid = str(user["id"])
    oid = str(user["organization_id"])
    root = (
        await session.execute(
            text(
                "SELECT m.id, m.subject, m.content, m.sender_id, m.recipient_ids, m.created_at,"
                " u.full_name AS sender_name"
                " FROM messages m JOIN users u ON u.id = m.sender_id"
                " WHERE m.id = CAST(:mid AS uuid) AND m.organization_id = CAST(:oid AS uuid)"
                f"{_inbox_visibility_clause()}"
            ).bindparams(mid=message_id, uid=uid, oid=oid),
        )
    ).mappings().first()
    if not root:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message introuvable")

    thread_id = root["id"]
    replies = (
        await session.execute(
            text(
                "SELECT m.id, m.content, m.sender_id, m.created_at, u.full_name AS sender_name"
                " FROM messages m JOIN users u ON u.id = m.sender_id"
                " WHERE m.organization_id = CAST(:oid AS uuid)"
                " AND (m.id = CAST(:tid AS uuid) OR m.thread_parent_id = CAST(:tid AS uuid))"
                " ORDER BY m.created_at ASC"
            ).bindparams(oid=oid, tid=str(thread_id)),
        )
    ).mappings().all()

    await session.execute(
        text(
            "INSERT INTO message_reads (message_id, user_id)"
            " SELECT CAST(:mid AS uuid), CAST(:uid AS uuid)"
            " WHERE NOT EXISTS ("
            "   SELECT 1 FROM message_reads WHERE message_id = CAST(:mid AS uuid)"
            "   AND user_id = CAST(:uid AS uuid)"
            " )"
        ).bindparams(mid=message_id, uid=uid),
    )
    await session.commit()
    return {"root": dict(root), "messages": [dict(r) for r in replies]}


@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_inbox_message(
    body: SendIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.broadcast:
        if not _is_admin(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Seuls les administrateurs peuvent envoyer à toute l'équipe")
        recipient_ids = None
    elif body.recipient_ids is None:
        if _is_admin(user):
            recipient_ids = None
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sélectionnez au moins un destinataire")
    else:
        recipient_ids = body.recipient_ids
        if not recipient_ids:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sélectionnez au moins un destinataire")

    mid = uuid.uuid4()
    oid = str(user["organization_id"])

    await session.execute(
        text(
            "INSERT INTO messages (id, organization_id, channel_id, sender_id, subject, content,"
            " recipient_ids, category) VALUES (CAST(:mid AS uuid), CAST(:oid AS uuid), NULL,"
            " CAST(:uid AS uuid), :subject, :content, :rids, :category)"
        ).bindparams(
            mid=str(mid),
            oid=oid,
            uid=str(user["id"]),
            subject=body.subject,
            content=body.content,
            rids=recipient_ids,
            category=body.category if recipient_ids is None else "info",
        ),
    )

    target = "toute l'équipe" if recipient_ids is None else f"{len(recipient_ids)} membre(s)"
    preview = body.content[:120].replace("\n", " ")
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="message",
        entity_id=str(mid),
        note=f"Message « {body.subject} » à {target}: {preview}",
        source_module="messages",
        source_id=str(mid),
    )
    await session.commit()
    return {"id": str(mid)}


@router.post("/voice-note", status_code=status.HTTP_201_CREATED)
async def send_voice_note_message(
    audio: UploadFile = File(...),
    subject: str = Form("Message vocal"),
    recipient_ids: str | None = Form(None),
    broadcast: bool = Form(False),
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    content_bytes, filename, content_type = await read_upload_audio(audio)
    voice = await ingest_voice_note(
        session,
        user,
        content=content_bytes,
        filename=filename,
        content_type=content_type,
        title=subject,
    )
    transcript = voice.get("transcript", "")
    summary = voice.get("ai_summary") or ""
    body = transcript
    if summary:
        body = f"{transcript}\n\n---\nRésumé: {summary}"

    parsed_ids: list[str] | None = None
    if recipient_ids:
        try:
            parsed = json.loads(recipient_ids)
            parsed_ids = parsed if isinstance(parsed, list) else [recipient_ids]
        except json.JSONDecodeError:
            parsed_ids = [x.strip() for x in recipient_ids.split(",") if x.strip()]

    if broadcast:
        if not _is_admin(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Seuls les administrateurs peuvent envoyer à toute l'équipe")
        rids = None
    elif parsed_ids is None:
        if _is_admin(user):
            rids = None
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sélectionnez au moins un destinataire")
    else:
        rids = parsed_ids
        if not rids:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sélectionnez au moins un destinataire")

    mid = uuid.uuid4()
    oid = str(user["organization_id"])
    await session.execute(
        text(
            "INSERT INTO messages (id, organization_id, channel_id, sender_id, subject, content,"
            " recipient_ids) VALUES (CAST(:mid AS uuid), CAST(:oid AS uuid), NULL,"
            " CAST(:uid AS uuid), :subject, :content, :rids)"
        ).bindparams(
            mid=str(mid),
            oid=oid,
            uid=str(user["id"]),
            subject=subject,
            content=body,
            rids=rids,
        ),
    )
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="message",
        entity_id=str(mid),
        note=f"Message vocal « {subject} »: {(summary or transcript)[:200]}",
        source_module="messages",
        source_id=str(mid),
    )
    await session.commit()
    return {
        "id": str(mid),
        "voice_document_id": voice.get("id"),
        "transcript": transcript,
        "ai_summary": summary,
    }


@router.patch("/{message_id}/read")
async def mark_read(
    message_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    uid = str(user["id"])
    oid = str(user["organization_id"])
    exists = (
        await session.execute(
            text(
                "SELECT 1 FROM messages m WHERE m.id = CAST(:mid AS uuid)"
                " AND m.organization_id = CAST(:oid AS uuid)"
                f"{_inbox_visibility_clause()}"
            ).bindparams(mid=message_id, uid=uid, oid=oid),
        )
    ).first()
    if not exists:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message introuvable")
    await session.execute(
        text(
            "INSERT INTO message_reads (message_id, user_id)"
            " VALUES (CAST(:mid AS uuid), CAST(:uid AS uuid))"
            " ON CONFLICT DO NOTHING"
        ).bindparams(mid=message_id, uid=uid),
    )
    await session.commit()
    return {"read": True}


# --- Legacy channel API (kept for backward compatibility) ---

@router.get("/channels")
async def list_channels(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await session.execute(
            text(
                "SELECT c.id, c.name, c.project_id, c.is_direct, c.created_at"
                " FROM channels c"
                " WHERE c.organization_id = CAST(:oid AS uuid) ORDER BY c.name"
            ).bindparams(oid=str(user["organization_id"])),
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.get("/channels/{channel_id}")
async def list_channel_messages(
    channel_id: str,
    cursor: str | None = None,
    limit: int = Query(default=50, le=200),
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    cc, cparams = cursor_clause(cursor)
    params: dict = {
        "cid": channel_id,
        "oid": str(user["organization_id"]),
        "lim": limit + 1,
        **cparams,
    }
    rows = [
        dict(r)
        for r in (
            await session.execute(
                text(
                    "SELECT m.id, m.content, m.sender_id, m.attachments, m.is_pinned,"
                    " m.thread_parent_id, m.created_at, u.full_name AS sender_name"
                    " FROM messages m JOIN users u ON u.id = m.sender_id"
                    " WHERE m.channel_id = CAST(:cid AS uuid)"
                    " AND m.organization_id = CAST(:oid AS uuid)"
                    f"{cc} ORDER BY m.created_at DESC, m.id DESC LIMIT :lim"
                ).bindparams(**params),
            )
        ).mappings().all()
    ]
    page = paginate_response(rows, limit=limit, cursor_fields=["created_at", "id"])
    page["items"] = list(reversed(page["items"]))
    return page


@router.post("", status_code=status.HTTP_201_CREATED)
async def send_channel_message(
    body: MessageIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    mid = uuid.uuid4()
    oid = str(user["organization_id"])
    channel_name = await _assert_channel_in_org(session, body.channel_id, oid)

    await session.execute(
        text(
            "INSERT INTO messages (id, organization_id, channel_id, sender_id, content,"
            " thread_parent_id) VALUES (CAST(:mid AS uuid), CAST(:oid AS uuid),"
            " CAST(:cid AS uuid), CAST(:uid AS uuid), :content, CAST(:tpid AS uuid))"
        ).bindparams(
            mid=str(mid),
            oid=oid,
            cid=body.channel_id,
            uid=str(user["id"]),
            content=body.content,
            tpid=body.thread_parent_id,
        ),
    )

    preview = body.content[:120].replace("\n", " ")
    brain = MemoryService(session)
    await brain.write_memory(
        org_id=oid,
        type="episodic",
        entity_type="message",
        entity_id=str(mid),
        note=f"Message dans #{channel_name}: {preview}",
        source_module="messages",
        source_id=str(mid),
    )
    await session.commit()

    event = {"type": "message", "channel_id": body.channel_id, "id": str(mid)}
    for queue in _subscribers.get(body.channel_id, []):
        await queue.put(event)

    return {"id": str(mid)}


@router.get("/stream/{channel_id}")
async def message_stream(
    channel_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    await _assert_channel_in_org(session, channel_id, str(user["organization_id"]))
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers[channel_id].append(queue)

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                except TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
        finally:
            _subscribers[channel_id].remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/channels/{channel_id}/pin/{message_id}")
async def pin_message(
    channel_id: str,
    message_id: str,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    await _assert_channel_in_org(session, channel_id, oid)
    await session.execute(
        text(
            "UPDATE messages SET is_pinned = true WHERE id = CAST(:mid AS uuid)"
            " AND channel_id = CAST(:cid AS uuid) AND organization_id = CAST(:oid AS uuid)"
        ).bindparams(mid=message_id, cid=channel_id, oid=oid),
    )
    await session.commit()
    return {"pinned": message_id}
