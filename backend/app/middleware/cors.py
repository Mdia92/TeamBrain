"""CORS — explicit allowlist; localhost regex only in development."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

_DEV_ORIGINS = (
    "http://localhost:3010",
    "http://127.0.0.1:3010",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)

_DEV_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"


def add_cors(app: FastAPI) -> None:
    configured = settings.cors_origin_list
    if settings.environment == "development":
        origins = list(dict.fromkeys([*configured, *_DEV_ORIGINS])) if configured else list(_DEV_ORIGINS)
        cors_kwargs: dict = {"allow_origin_regex": _DEV_ORIGIN_REGEX}
    else:
        origins = configured or []
        cors_kwargs = {}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
        expose_headers=["Content-Type", "Content-Length"],
        max_age=600,
        **cors_kwargs,
    )
