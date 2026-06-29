"""Twilio media download and WhatsApp group perceive helpers."""

from __future__ import annotations

import re

import httpx

from app.config import settings

GROUP_JID_RE = re.compile(r"@g\.us", re.I)
MEETING_START_RE = re.compile(
    r"^\s*(meeting|réunion|reunion|standup|call|appel|sync)\b",
    re.I,
)
MEETING_HASHTAG_RE = re.compile(r"#meeting\b", re.I)
MEETING_INLINE_RE = re.compile(r"\b(meeting|réunion|reunion|standup|call)\b", re.I)
AUDIO_CONTENT_PREFIX = ("audio/", "application/ogg")


def parse_group_id(from_addr: str, explicit_group_id: str | None = None) -> str | None:
    if explicit_group_id and explicit_group_id.strip():
        return explicit_group_id.strip()
    addr = (from_addr or "").replace("whatsapp:", "").strip()
    if GROUP_JID_RE.search(addr):
        return addr
    if addr.count("-") >= 2 and not addr.startswith("+"):
        return addr
    return None


def is_audio_media(num_media: int, media_content_type: str | None) -> bool:
    if num_media < 1:
        return False
    ct = (media_content_type or "").lower()
    return ct.startswith(AUDIO_CONTENT_PREFIX) or "ogg" in ct or "mpeg" in ct


def is_whatsapp_meeting_context(
    *,
    body: str,
    group_id: str | None,
    participant_count: int | None,
    has_audio: bool,
) -> bool:
    text = (body or "").strip()
    if MEETING_HASHTAG_RE.search(text):
        return True
    if MEETING_START_RE.search(text):
        return True
    if has_audio and MEETING_INLINE_RE.search(text):
        return True
    if has_audio and group_id:
        return True
    if has_audio and participant_count is not None and participant_count >= 3:
        return True
    return False


async def download_twilio_media(media_url: str) -> tuple[bytes, str | None]:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise RuntimeError("Twilio non configuré")
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        response = await client.get(
            media_url,
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        )
        response.raise_for_status()
        return response.content, response.headers.get("content-type")


def extract_speaker_names(transcript: str) -> list[str]:
    """Detect speaker labels like 'Amadou:' or '- Fatou —'."""
    names: list[str] = []
    seen: set[str] = set()
    for line in transcript.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^[-*]?\s*([A-ZÀ-Ÿ][a-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-]+)?)\s*[:—\-]", line)
        if m:
            name = m.group(1).strip()
            key = name.lower()
            if key not in seen:
                seen.add(key)
                names.append(name)
    return names
