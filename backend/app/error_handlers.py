"""French-friendly JSON error handlers."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

_FALLBACK_FR: dict[int, str] = {
    status.HTTP_401_UNAUTHORIZED: "Authentification requise",
    status.HTTP_403_FORBIDDEN: "Accès refusé",
    status.HTTP_404_NOT_FOUND: "Ressource introuvable",
    status.HTTP_409_CONFLICT: "Conflit",
    status.HTTP_422_UNPROCESSABLE_ENTITY: "Données invalides",
    status.HTTP_429_TOO_MANY_REQUESTS: "Trop de requêtes",
}


def _french_detail(exc: StarletteHTTPException) -> str:
    raw = exc.detail
    if isinstance(raw, str) and raw.strip():
        return raw
    return _FALLBACK_FR.get(exc.status_code, "Erreur")


async def http_exception_handler(_: object, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": _french_detail(exc)})


async def rate_limit_handler(_: object, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Trop de requêtes — veuillez patienter"},
    )


async def validation_handler(_: object, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Données invalides", "errors": exc.errors()},
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erreur serveur — réessayez ou contactez le support."},
    )


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
    app.add_exception_handler(RequestValidationError, validation_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
