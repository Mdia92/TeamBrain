"""AI Assistant API."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import core
from app.auth.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class AskIn(BaseModel):
    question: str = Field(min_length=3)


@router.post("/ask")
async def ask(
    body: AskIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await core.ask(
        session, str(user["organization_id"]), body.question, user_id=str(user["id"])
    )
    payload = {
        "answer": result.answer,
        "confidence": result.confidence,
        "confidence_label": result.confidence_label,
        "sources": result.sources,
        "model": result.model,
        "actions_taken": result.actions_taken,
        "api_configured": result.api_configured,
        "grounded": result.grounded,
    }
    await session.execute(
        text(
            "INSERT INTO agent_runs (id, organization_id, agent_type, input, output, confidence, model)"
            " VALUES (gen_random_uuid(), CAST(:oid AS uuid), 'assistant',"
            " CAST(:inp AS jsonb), CAST(:out AS jsonb), :conf, :model)"
        ).bindparams(
            oid=str(user["organization_id"]),
            inp=json.dumps({"question": body.question[:200]}),
            out=json.dumps(payload),
            conf=result.confidence,
            model=result.model,
        ),
    )
    await session.commit()
    return payload
