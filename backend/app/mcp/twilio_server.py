"""Twilio webhook integration — group audio → Meetings Agent."""

from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.meetings_agent import PerceivedWhatsAppMeeting, run_meetings_agent
from app.services.whatsapp_media import (
    download_twilio_media,
    is_audio_media,
    is_whatsapp_meeting_context,
    parse_group_id,
)
from app.workers.transcription import transcribe_audio

log = structlog.get_logger("teambrain.twilio_server")


def perceive_whatsapp_message(params: dict[str, str]) -> PerceivedWhatsAppMeeting:
    from_addr = params.get("From", "")
    body = params.get("Body", "")
    num_media = int(params.get("NumMedia") or "0")
    media_url = params.get("MediaUrl0") if num_media > 0 else None
    group_id = parse_group_id(from_addr, params.get("GroupId") or params.get("ConversationSid"))

    return PerceivedWhatsAppMeeting(
        audio_url=media_url,
        group_id=group_id,
        sender_name=params.get("ProfileName") or params.get("WaId"),
        caption=body,
        timestamp=params.get("MessageTimestamp"),
    )


def should_run_meetings_agent(perceived: PerceivedWhatsAppMeeting, params: dict[str, str]) -> bool:
    num_media = int(params.get("NumMedia") or "0")
    has_audio = is_audio_media(num_media, params.get("MediaContentType0"))
    if not has_audio or not perceived.audio_url:
        return False
    return is_whatsapp_meeting_context(
        body=perceived.caption,
        group_id=perceived.group_id,
        participant_count=int(params["ParticipantCount"])
        if params.get("ParticipantCount", "").isdigit()
        else None,
        has_audio=True,
    )


async def process_group_audio_message(
    session: AsyncSession,
    *,
    org_id: str,
    params: dict[str, str],
    source_user_id: str | None = None,
) -> dict[str, Any]:
    """Download audio, transcribe, run Meetings Agent."""
    perceived = perceive_whatsapp_message(params)
    if not should_run_meetings_agent(perceived, params):
        return {"status": "skipped", "reason": "not_meeting_audio"}

    audio_bytes, content_type = await download_twilio_media(perceived.audio_url or "")
    filename = "whatsapp-group.ogg"
    if content_type and "mpeg" in content_type:
        filename = "whatsapp-group.mp3"
    elif content_type and "wav" in content_type:
        filename = "whatsapp-group.wav"

    transcript = await transcribe_audio(audio_bytes, filename, content_type)
    if not transcript or transcript.startswith("["):
        return {"status": "error", "reason": "transcription_failed"}

    agent_result = await run_meetings_agent(
        session,
        org_id=org_id,
        transcript=transcript,
        perceived=perceived,
        source_user_id=source_user_id,
    )

    return {
        "status": "processed" if not agent_result.skipped else "skipped",
        "reason": agent_result.skip_reason,
        "summary": agent_result.summary,
        "confidence": agent_result.confidence,
        "finding_ids": agent_result.finding_ids,
        "pending_action_ids": agent_result.pending_action_ids,
        "unmapped_people": agent_result.unmapped_people,
    }
