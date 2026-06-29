"""Meetings Agent — WhatsApp group capture tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.meeting_extractor import MeetingExtraction
from app.agents.meetings_agent import (
    PerceivedWhatsAppMeeting,
    map_people_to_members,
    rule_extract_meeting,
    verify_extraction,
)
from app.mcp.twilio_server import perceive_whatsapp_message, should_run_meetings_agent
from app.services.whatsapp_media import (
    extract_speaker_names,
    is_whatsapp_meeting_context,
    parse_group_id,
)


def test_parse_group_id_from_gus():
    assert parse_group_id("whatsapp:120363123456789012@g.us") == "120363123456789012@g.us"


def test_is_whatsapp_meeting_context_keywords():
    assert is_whatsapp_meeting_context(
        body="Meeting: budget review",
        group_id=None,
        participant_count=None,
        has_audio=True,
    )
    assert is_whatsapp_meeting_context(
        body="Notes #meeting",
        group_id=None,
        participant_count=None,
        has_audio=False,
    )


def test_should_run_meetings_agent_with_audio_and_group():
    params = {
        "From": "whatsapp:120363123456789012@g.us",
        "Body": "Réunion hebdo",
        "NumMedia": "1",
        "MediaUrl0": "https://api.twilio.com/media/abc",
        "MediaContentType0": "audio/ogg",
        "ProfileName": "Amadou Diallo",
    }
    perceived = perceive_whatsapp_message(params)
    assert perceived.group_id is not None
    assert should_run_meetings_agent(perceived, params)


def test_meeting_decision_and_deadline_extraction():
    transcript = "Meeting: we decided to hire 2 people by July"
    extraction = rule_extract_meeting(transcript)
    assert extraction.decisions
    assert "hire" in extraction.decisions[0].lower() or "decided" in extraction.decisions[0].lower()
    assert extraction.action_items or "july" in transcript.lower()


def test_multiple_speakers_recognized():
    transcript = (
        "Amadou: Nous devons recruter deux personnes.\n"
        "Fatou: Je m'occupe des entretiens avant juillet.\n"
        "Moussa: D'accord pour le budget."
    )
    names = extract_speaker_names(transcript)
    assert "Amadou" in names
    assert "Fatou" in names
    assert len(names) >= 2


def test_people_mapped_to_org_members():
    members = ["Amadou Diallo", "Fatou Sarr", "Moussa Ba"]
    mapped, unmapped = map_people_to_members(["Amadou", "Fatou", "Mamadou"], members)
    assert any(m["mentioned"] == "Amadou" for m in mapped)
    assert "Mamadou" in unmapped


def test_verify_flags_unmapped_person():
    extraction = MeetingExtraction(
        summary="Réunion recrutement",
        decisions=["Nous avons décidé d'embaucher"],
        action_items=[],
        commitments=[],
    )
    transcript = "Mamadou: Je valide le plan de recrutement."
    members = ["Amadou Diallo", "Fatou Sarr"]
    grounded, unmapped = verify_extraction(extraction, transcript, members)
    assert grounded
    assert "Mamadou" in unmapped


@pytest.mark.asyncio
async def test_run_meetings_agent_creates_pending_action():
    from app.agents.meetings_agent import run_meetings_agent

    extraction = MeetingExtraction(
        summary="Décision recrutement",
        decisions=["Embaucher 2 personnes avant juillet"],
        commitments=[],
        action_items=[],
    )

    async def fake_reason(transcript: str):
        return extraction, 0.88, transcript

    session = AsyncMock()

    with (
        patch("app.agents.meetings_agent._load_member_names", new_callable=AsyncMock, return_value=["Amadou Diallo"]),
        patch("app.agents.meetings_agent.reason_whatsapp_meeting", side_effect=fake_reason),
        patch("app.agents.meetings_agent.write_finding", new_callable=AsyncMock) as wf,
        patch("app.agents.meetings_agent.create_pending_action", new_callable=AsyncMock) as cpa,
        patch("app.agents.meetings_agent.MemoryService") as mem_cls,
    ):
        wf.side_effect = ["f1", "f2", "f3"]
        cpa.return_value = "pa-1"
        mem_cls.return_value.write_memory = AsyncMock(return_value="m1")

        perceived = PerceivedWhatsAppMeeting(
            audio_url="https://x/audio.ogg",
            group_id="group-1",
            sender_name="Amadou",
            caption="Meeting standup",
        )
        result = await run_meetings_agent(
            session,
            org_id="00000000-0000-0000-0000-000000000001",
            transcript="Meeting: we decided to hire 2 people by July",
            perceived=perceived,
            source_user_id="00000000-0000-0000-0000-000000000002",
        )

    assert result.confidence >= 0.8
    assert result.pending_action_ids == ["pa-1"]
    cpa.assert_called_once()
    assert cpa.call_args.kwargs["action_type"] == "meeting_suggestion"
