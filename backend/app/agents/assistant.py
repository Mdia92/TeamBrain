"""Org-grounded AI assistant — delegates to Team Brain core."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import core


async def ask_assistant(session: AsyncSession, org_id: str, question: str, user_id: str | None = None) -> dict:
    result = await core.ask(session, org_id, question, user_id=user_id)
    return {
        "answer": result.answer,
        "confidence": result.confidence,
        "sources": result.sources,
        "model": result.model,
    }
