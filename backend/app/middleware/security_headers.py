"""Security headers middleware."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config import settings

_CSP_BASELINE = (
    "'self' https://generativelanguage.googleapis.com https://api.groq.com "
    "https://api.mistral.ai https://api.openai.com https://maps.googleapis.com"
)


def _build_csp() -> str:
    extra = " ".join(o.strip() for o in settings.csp_extra_connect_src.split(",") if o.strip())
    connect_src = f"{_CSP_BASELINE} {extra}".strip()
    return (
        "default-src 'self'; "
        "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com; "
        "script-src 'self' https://maps.googleapis.com; "
        f"connect-src {connect_src}"
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Content-Security-Policy", _build_csp())
        return response
