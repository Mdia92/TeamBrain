"""Shared slowapi limiter — per-org when JWT present, else per-IP."""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _rate_limit_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from app.auth.jwt import decode_token

            payload = decode_token(auth[7:])
            if payload and payload.get("org"):
                return f"org:{payload['org']}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key, default_limits=["200/minute"])
