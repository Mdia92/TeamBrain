"""Text embeddings — Gemini 2.5 with hash fallback for offline/tests."""

from __future__ import annotations

import hashlib
import struct

import httpx
import structlog

from app.agents.llm_client import GEMINI_EMBED_MODEL
from app.config import settings

log = structlog.get_logger("teambrain.embeddings")

EMBED_DIM = 384


def _hash_embedding(text: str, dim: int = EMBED_DIM) -> list[float]:
    digest = hashlib.sha256(text.encode()).digest()
    values: list[float] = []
    while len(values) < dim:
        for i in range(0, len(digest) - 3, 4):
            chunk = digest[i : i + 4]
            values.append((struct.unpack(">I", chunk)[0] / 2**32) * 2 - 1)
            if len(values) >= dim:
                break
        digest = hashlib.sha256(digest).digest()
    return values[:dim]


async def _gemini_embedding(text: str) -> list[float] | None:
    if not settings.gemini_api_key:
        return None
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_EMBED_MODEL}:embedContent?key={settings.gemini_api_key}"
    )
    body = {"model": f"models/{GEMINI_EMBED_MODEL}", "content": {"parts": [{"text": text[:8000]}]}}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=body)
            if r.status_code != 200:
                return None
            values = r.json()["embedding"]["values"]
            if len(values) > EMBED_DIM:
                return values[:EMBED_DIM]
            if len(values) < EMBED_DIM:
                return values + [0.0] * (EMBED_DIM - len(values))
            return values
    except Exception:
        log.warning("gemini_embedding_failed", exc_info=True)
        return None


async def embed_text(text: str) -> tuple[list[float], str]:
    gemini = await _gemini_embedding(text)
    if gemini:
        return gemini, "gemini"
    return _hash_embedding(text), "hash_fallback"


def vector_to_pg(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"
