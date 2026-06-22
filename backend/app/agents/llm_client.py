"""LLM client with fallback chain: Gemini -> Groq -> Mistral."""

from __future__ import annotations

import httpx
import structlog

from app.config import settings

log = structlog.get_logger("teambrain.llm")

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_EMBED_MODEL = "text-embedding-005"


def llm_configured() -> bool:
    return bool(settings.gemini_api_key or settings.groq_api_key or settings.mistral_api_key)


async def _call_gemini(prompt: str, system: str = "") -> str | None:
    if not settings.gemini_api_key:
        return None
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={settings.gemini_api_key}"
    )
    body = {
        "contents": [{"parts": [{"text": f"{system}\n\n{prompt}" if system else prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=body)
        if r.status_code != 200:
            return None
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_groq(prompt: str, system: str = "") -> str | None:
    if not settings.groq_api_key:
        return None
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={"model": "llama-3.3-70b-versatile", "messages": messages, "temperature": 0.2},
        )
        if r.status_code != 200:
            return None
        return r.json()["choices"][0]["message"]["content"]


async def _call_mistral(prompt: str, system: str = "") -> str | None:
    if not settings.mistral_api_key:
        return None
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.mistral_api_key}"},
            json={"model": "mistral-small-latest", "messages": messages, "temperature": 0.2},
        )
        if r.status_code != 200:
            return None
        return r.json()["choices"][0]["message"]["content"]


async def generate_text(prompt: str, system: str = "") -> tuple[str, str]:
    """Returns (text, model_used). Falls back through the chain."""
    if not llm_configured():
        return "Configurez une clé API dans les paramètres.", "none"
    for name, fn in [
        ("gemini-2.5-flash", _call_gemini),
        ("groq", _call_groq),
        ("mistral", _call_mistral),
    ]:
        try:
            result = await fn(prompt, system)
            if result:
                return result, name
        except Exception:
            log.warning(f"{name}_failed", exc_info=True)
    return "Service IA temporairement indisponible.", "none"
