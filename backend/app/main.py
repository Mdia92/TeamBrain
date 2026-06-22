"""TeamBrain FastAPI application."""

from fastapi import FastAPI

from app.api import (
    assistant,
    auth,
    calendar,
    daily_status,
    dashboard,
    documents,
    events,
    field_reports,
    health,
    meetings,
    messages,
    projects,
    sync,
    tasks,
    whatsapp,
)
from app.error_handlers import install_error_handlers
from app.middleware.audit import AuditMiddleware
from app.middleware.cors import add_cors
from app.middleware.logging import RequestLoggingMiddleware, configure_logging
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.rate_limit import limiter

configure_logging()

app = FastAPI(title="TeamBrain API", version="0.1.0")
app.state.limiter = limiter
install_error_handlers(app)

app.add_middleware(AuditMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
add_cors(app)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(documents.router)
app.include_router(messages.router)
app.include_router(calendar.router)
app.include_router(daily_status.router)
app.include_router(field_reports.router)
app.include_router(meetings.router)
app.include_router(whatsapp.router)
app.include_router(assistant.router)
app.include_router(sync.router)
app.include_router(events.router)


@app.get("/")
async def root() -> dict:
    return {"name": "TeamBrain", "status": "ok"}
