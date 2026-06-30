"""Device push + in-app org notification inbox."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.db.sql_compat import is_sqlite
from app.pagination import paginate_response

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


@router.get("/inbox")
async def list_inbox(
    cursor: str | None = None,
    limit: int = Query(default=30, le=100),
    unread_only: bool = False,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    oid = str(user["organization_id"])
    uid = str(user["id"])
    extra = " AND read_at IS NULL" if unread_only else ""
    if is_sqlite():
        rows = [
            dict(r)
            for r in (
                await session.execute(
                    text(
                        "SELECT id, module, action, title, body, entity_type, entity_id,"
                        " link_path, read_at, created_at"
                        " FROM org_notifications"
                        " WHERE organization_id = :oid AND user_id = :uid"
                        f"{extra} ORDER BY created_at DESC LIMIT :lim"
                    ).bindparams(oid=oid, uid=uid, lim=limit + 1),
                )
            ).mappings().all()
        ]
    else:
        rows = [
            dict(r)
            for r in (
                await session.execute(
                    text(
                        "SELECT id, module, action, title, body, entity_type, entity_id::text,"
                        " link_path, read_at, created_at"
                        " FROM org_notifications"
                        " WHERE organization_id = CAST(:oid AS uuid) AND user_id = CAST(:uid AS uuid)"
                        f"{extra} ORDER BY created_at DESC LIMIT :lim"
                    ).bindparams(oid=oid, uid=uid, lim=limit + 1),
                )
            ).mappings().all()
        ]
    for row in rows[:limit]:
        row["id"] = str(row["id"])
        if row.get("entity_id"):
            row["entity_id"] = str(row["entity_id"])
    unread = 0
    if is_sqlite():
        unread = (
            await session.execute(
                text(
                    "SELECT COUNT(*) FROM org_notifications"
                    " WHERE organization_id = :oid AND user_id = :uid AND read_at IS NULL"
                ).bindparams(oid=oid, uid=uid),
            )
        ).scalar() or 0
    else:
        unread = (
            await session.execute(
                text(
                    "SELECT COUNT(*) FROM org_notifications"
                    " WHERE organization_id = CAST(:oid AS uuid)"
                    " AND user_id = CAST(:uid AS uuid) AND read_at IS NULL"
                ).bindparams(oid=oid, uid=uid),
            )
        ).scalar() or 0
    return {
        **paginate_response(rows, limit=limit, cursor_fields=["created_at", "id"]),
        "unread_count": int(unread),
    }


@router.post("/inbox/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    oid = str(user["organization_id"])
    uid = str(user["id"])
    if is_sqlite():
        await session.execute(
            text(
                "UPDATE org_notifications SET read_at = datetime('now')"
                " WHERE organization_id = :oid AND user_id = :uid AND read_at IS NULL"
            ).bindparams(oid=oid, uid=uid),
        )
    else:
        await session.execute(
            text(
                "UPDATE org_notifications SET read_at = now()"
                " WHERE organization_id = CAST(:oid AS uuid)"
                " AND user_id = CAST(:uid AS uuid) AND read_at IS NULL"
            ).bindparams(oid=oid, uid=uid),
        )
    await session.commit()
