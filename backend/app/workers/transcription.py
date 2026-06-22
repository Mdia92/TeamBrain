"""Meeting transcription worker."""

from __future__ import annotations

import httpx

from app.config import settings


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    if settings.openai_api_key:
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files={"file": (filename, audio_bytes)},
                data={"model": "whisper-1", "language": "fr"},
            )
            if r.status_code == 200:
                return r.json().get("text", "")

    if settings.deepgram_api_key:
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(
                "https://api.deepgram.com/v1/listen?language=fr",
                headers={
                    "Authorization": f"Token {settings.deepgram_api_key}",
                    "Content-Type": "audio/webm",
                },
                content=audio_bytes,
            )
            if r.status_code == 200:
                data = r.json()
                return data["results"]["channels"][0]["alternatives"][0]["transcript"]

    return "[Transcription indisponible — configurez OPENAI_API_KEY ou DEEPGRAM_API_KEY]"
