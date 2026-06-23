"""Device push notification registration."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class RegisterDeviceIn(BaseModel):
    token: str = Field(min_length=10)
    platform: str = Field(pattern="^(ios|android|web)$")
    user_id: str | None = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_device(
    body: RegisterDeviceIn,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.user_id and body.user_id != str(user["id"]):
        return {"status": "ignored"}
    await session.execute(
        text(
            "INSERT INTO device_tokens (id, user_id, organization_id, token, platform, updated_at)"
            " VALUES (gen_random_uuid(), CAST(:uid AS uuid), CAST(:oid AS uuid), :token, :platform, now())"
            " ON CONFLICT (user_id, token) DO UPDATE SET platform = EXCLUDED.platform, updated_at = now()"
        ).bindparams(
            uid=str(user["id"]),
            oid=str(user["organization_id"]),
            token=body.token,
            platform=body.platform,
        ),
    )
    await session.commit()
    return {"status": "registered"}
