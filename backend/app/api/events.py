"""Events API — trigger background checks."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.db.session import get_db
from app.events.worker import run_event_checks

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("/run-checks")
async def run_checks(
    weekly: bool = False,
    user: dict = Depends(require_role("owner", "admin")),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await run_event_checks(session, include_weekly=weekly)
