"""Messaging API with SSE."""

from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.pagination import cursor_clause, paginate_response
from app.trial import require_write_access

router = APIRouter(prefix="/api/messages", tags=["messages"])

_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)


class MessageIn(BaseModel):
    channel_id: str
    content: str = Field(min_length=1)
    thread_parent_id: str | None = None


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
async def list_messages(
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
async def send_message(
    body: MessageIn,
    user: dict = Depends(require_write_access),
    session: AsyncSession = Depends(get_db),
) -> dict:
    mid = uuid.uuid4()
    oid = str(user["organization_id"])
    ch = (
        await session.execute(
            text("SELECT name FROM channels WHERE id = CAST(:cid AS uuid)").bindparams(cid=body.channel_id),
        )
    ).first()
    channel_name = ch[0] if ch else "channel"

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
async def message_stream(channel_id: str, user: dict = Depends(get_current_user)):
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
    await session.execute(
        text(
            "UPDATE messages SET is_pinned = true WHERE id = CAST(:mid AS uuid)"
            " AND channel_id = CAST(:cid AS uuid)"
        ).bindparams(mid=message_id, cid=channel_id),
    )
    await session.commit()
    return {"pinned": message_id}
