"""Meeting extraction agent — structured output from transcript."""

from __future__ import annotations

import json
import re

from pydantic import BaseModel, Field

from app.agents.llm_client import generate_text


class ActionItem(BaseModel):
    description: str
    assignee_name: str | None = None
    due_date: str | None = None


class Commitment(BaseModel):
    text: str
    person_name: str | None = None
    deadline: str | None = None


class MeetingExtraction(BaseModel):
    summary: str
    decisions: list[str] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list)
    commitments: list[Commitment] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    key_topics: list[str] = Field(default_factory=list)


EXTRACTION_SYSTEM = """Tu es un assistant qui extrait des informations structurées de transcriptions de réunions.
Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "summary": "résumé 3-5 phrases",
  "decisions": ["décision 1"],
  "action_items": [{"description": "...", "assignee_name": "...", "due_date": "YYYY-MM-DD ou null"}],
  "commitments": [{"text": "...", "person_name": "...", "deadline": "YYYY-MM-DD ou null"}],
  "open_questions": ["question non résolue"],
  "key_topics": ["tag1", "tag2"]
}
Langue: français."""


async def extract_meeting_intelligence(transcript: str) -> tuple[MeetingExtraction, str]:
    prompt = f"Transcription de réunion:\n\n{transcript[:12000]}"
    raw, model = await generate_text(prompt, EXTRACTION_SYSTEM)
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            return MeetingExtraction.model_validate(data), model
        except (json.JSONDecodeError, ValueError):
            pass
    return MeetingExtraction(summary=raw[:500]), model
