"""Attach CORS headers to error responses (Starlette 500s skip CORSMiddleware)."""

from __future__ import annotations

import re

from starlette.requests import Request
from starlette.responses import Response

from app.config import settings

_DEV_ORIGIN_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")


def _allowed_origin(origin: str | None) -> str | None:
    if not origin:
        return None
    configured = settings.cors_origin_list
    if origin in configured:
        return origin
    if _DEV_ORIGIN_REGEX.match(origin):
        return origin
    return None


def apply_cors_to_response(request: Request, response: Response) -> Response:
    origin = _allowed_origin(request.headers.get("origin"))
    if origin:
        response.headers.setdefault("Access-Control-Allow-Origin", origin)
        response.headers.setdefault("Access-Control-Allow-Credentials", "true")
    return response
