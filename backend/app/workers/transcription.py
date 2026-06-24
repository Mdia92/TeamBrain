"""Audio transcription — Gemini first, then Groq/OpenAI Whisper, then Deepgram."""

from __future__ import annotations

import base64
import mimetypes

import httpx

from app.config import settings

_GEMINI_MODEL = "gemini-2.5-flash"
_TRANSCRIBE_PROMPT = (
    "Transcris cet enregistrement audio en français. "
    "Réponds uniquement avec le texte transcrit, sans commentaire."
)

_AUDIO_EXTS = frozenset({".m4a", ".mp3", ".ogg", ".wav", ".webm", ".mpeg", ".mp4", ".aac"})


def is_audio_filename(filename: str, content_type: str | None = None) -> bool:
    lower = (filename or "").lower()
    if any(lower.endswith(ext) for ext in _AUDIO_EXTS):
        return True
    if content_type:
        ct = content_type.lower()
        return ct.startswith("audio/") or ct in ("video/mp4", "application/ogg")
    return False


def _mime_type(filename: str, content_type: str | None) -> str:
    if content_type and (content_type.startswith("audio/") or content_type == "video/mp4"):
        return content_type.split(";")[0].strip()
    guessed, _ = mimetypes.guess_type(filename)
    if guessed:
        return guessed
    lower = filename.lower()
    if lower.endswith(".m4a"):
        return "audio/mp4"
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".ogg"):
        return "audio/ogg"
    if lower.endswith(".wav"):
        return "audio/wav"
    return "audio/webm"


async def _transcribe_gemini(audio_bytes: bytes, filename: str, content_type: str | None) -> str | None:
    if not settings.gemini_api_key:
        return None
    mime = _mime_type(filename, content_type)
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{_GEMINI_MODEL}:generateContent?key={settings.gemini_api_key}"
    )
    body = {
        "contents": [
            {
                "parts": [
                    {"text": _TRANSCRIBE_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": b64}},
                ]
            }
        ],
        "generationConfig": {"temperature": 0.1},
    }
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(url, json=body)
        if r.status_code != 200:
            return None
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()


async def _transcribe_openai_compatible(
    audio_bytes: bytes,
    filename: str,
    *,
    api_key: str,
    base_url: str,
    model: str,
) -> str | None:
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(
            f"{base_url.rstrip('/')}/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (filename, audio_bytes)},
            data={"model": model, "language": "fr"},
        )
        if r.status_code == 200:
            return r.json().get("text", "").strip() or None
    return None


async def _transcribe_deepgram(audio_bytes: bytes, filename: str, content_type: str | None) -> str | None:
    if not settings.deepgram_api_key:
        return None
    mime = _mime_type(filename, content_type)
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(
            "https://api.deepgram.com/v1/listen?language=fr",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": mime,
            },
            content=audio_bytes,
        )
        if r.status_code == 200:
            data = r.json()
            return data["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
    return None


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    content_type: str | None = None,
) -> str:
    """Transcribe audio. Priority: Gemini → Groq Whisper → OpenAI Whisper → Deepgram."""
    providers = [_transcribe_gemini(audio_bytes, filename, content_type)]
    if settings.groq_api_key:
        providers.append(
            _transcribe_openai_compatible(
                audio_bytes,
                filename,
                api_key=settings.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
                model="whisper-large-v3",
            )
        )
    if settings.openai_api_key:
        providers.append(
            _transcribe_openai_compatible(
                audio_bytes,
                filename,
                api_key=settings.openai_api_key,
                base_url="https://api.openai.com/v1",
                model="whisper-1",
            )
        )
    providers.append(_transcribe_deepgram(audio_bytes, filename, content_type))

    for provider in providers:
        try:
            result = await provider
            if result:
                return result
        except Exception:
            continue

    return "[Transcription indisponible — configurez GEMINI_API_KEY, GROQ_API_KEY ou OPENAI_API_KEY]"
