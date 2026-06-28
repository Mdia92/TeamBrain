"""CORS — explicit allowlist + localhost regex for dev."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

_DEV_ORIGINS = (
    "http://localhost:3010",
    "http://127.0.0.1:3010",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)

# Any localhost / 127.0.0.1 port (dev servers, Capacitor live reload, etc.)
_DEV_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"


def add_cors(app: FastAPI) -> None:
    configured = settings.cors_origin_list
    origins = list(dict.fromkeys([*configured, *_DEV_ORIGINS])) if configured else list(_DEV_ORIGINS)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=_DEV_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
        expose_headers=["Content-Type", "Content-Length"],
        max_age=600,
    )
