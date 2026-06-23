"""AI Assistant API."""

from __future__ import annotations

import json

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import core
from app.auth.dependencies import get_current_user
from app.db.session import get_db

log = structlog.get_logger("teambrain.assistant")
router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class AskIn(BaseModel):
    question: str = Field(min_length=3)


@router.post("/ask")
async def ask(
    body: AskIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    try:
        result = await core.ask(
            session, str(user["organization_id"]), body.question, user_id=str(user["id"])
        )
    except Exception:
        log.exception("assistant_ask_failed")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "L'assistant est temporairement indisponible. Réessayez dans un instant.",
        ) from None
    payload = {
        "answer": result.answer,
        "confidence": result.confidence,
        "confidence_label": result.confidence_label,
        "sources": result.sources,
        "model": result.model,
        "actions_taken": result.actions_taken,
        "pending_suggestions": result.pending_suggestions,
        "api_configured": result.api_configured,
        "grounded": result.grounded,
    }
    try:
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
    except Exception:
        log.warning("agent_run_log_failed", exc_info=True)
    return payload
