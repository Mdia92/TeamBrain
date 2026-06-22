"""Health check."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "teambrain-api"}
