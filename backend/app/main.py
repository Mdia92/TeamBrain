"""TeamBrain FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi.middleware import SlowAPIMiddleware

from app.api import (
    activity,
    assistant,
    auth,
    automations,
    billing,
    calendar,
    daily_status,
    dashboard,
    documents,
    events,
    field_reports,
    health,
    invites,
    meetings,
    members,
    memory,
    messages,
    notifications,
    org_intel,
    organizations,
    pending_actions,
    projects,
    sync,
    tasks,
    webhooks,
    whatsapp,
)
from app.error_handlers import install_error_handlers
from app.middleware.audit import AuditMiddleware
from app.middleware.cors import add_cors
from app.middleware.logging import RequestLoggingMiddleware, configure_logging
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.rate_limit import limiter
from app.scheduler import start_scheduler, stop_scheduler
from app.startup import ensure_pgvector, validate_production_settings

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_production_settings()
    await ensure_pgvector()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="TeamBrain API", version="0.3.0", lifespan=lifespan)
app.state.limiter = limiter
install_error_handlers(app)

app.add_middleware(SlowAPIMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
# Last added = outermost — OPTIONS preflight must hit CORS before audit/rate-limit (/api/documents uploads).
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
app.include_router(members.router)
app.include_router(invites.router)
app.include_router(memory.router)
app.include_router(notifications.router)
app.include_router(activity.router)
app.include_router(pending_actions.router)
app.include_router(org_intel.router)
app.include_router(organizations.router)
app.include_router(automations.router)
app.include_router(billing.router)
app.include_router(webhooks.router)


@app.get("/")
async def root() -> dict:
    return {"name": "TeamBrain", "status": "ok", "version": "0.3.0"}
