"""CORS — explicit allowlist for local dev + production origins."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Always allow common local frontend origins (localhost vs 127.0.0.1 mismatch breaks uploads).
_DEV_ORIGINS = (
    "http://localhost:3010",
    "http://127.0.0.1:3010",
)


def add_cors(app: FastAPI) -> None:
    configured = settings.cors_origin_list
    origins = list(dict.fromkeys([*configured, *_DEV_ORIGINS])) if configured else list(_DEV_ORIGINS)

    # Outermost middleware — must run before auth/audit so OPTIONS preflight succeeds.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
        expose_headers=["Content-Type", "Content-Length"],
        max_age=600,
    )
