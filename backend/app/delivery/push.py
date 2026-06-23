"""Push notification delivery via Firebase Cloud Messaging."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)

_firebase_app = None


def _get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    from app.config import settings

    raw = settings.firebase_service_account_json
    if not raw:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            cred = credentials.Certificate(json.loads(raw))
            _firebase_app = firebase_admin.initialize_app(cred)
        else:
            _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except Exception as exc:
        log.warning("firebase_init_failed", extra={"error": str(exc)})
        return None


async def send_push(
    session: AsyncSession,
    *,
    user_id: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> int:
    """Send push to all registered devices for a user. Returns count sent."""
    if _get_firebase_app() is None:
        return 0

    from firebase_admin import messaging

    rows = (
        await session.execute(
            text("SELECT token FROM device_tokens WHERE user_id = CAST(:uid AS uuid)").bindparams(
                uid=user_id,
            ),
        )
    ).scalars().all()

    sent = 0
    for token in rows:
        try:
            messaging.send(
                messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data={k: str(v) for k, v in (data or {}).items()},
                    token=token,
                ),
            )
            sent += 1
        except Exception as exc:
            log.warning("push_send_failed", extra={"token": token[:8], "error": str(exc)})
    return sent


async def send_push_to_org_admins(
    session: AsyncSession,
    *,
    organization_id: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> int:
    """Notify owners/admins/managers in an organization."""
    rows = (
        await session.execute(
            text(
                "SELECT DISTINCT dt.user_id::text"
                " FROM device_tokens dt"
                " JOIN org_memberships om ON om.user_id = dt.user_id"
                " WHERE om.organization_id = CAST(:oid AS uuid)"
                " AND om.role IN ('owner', 'admin', 'manager')"
                " AND om.is_active = true"
            ).bindparams(oid=organization_id),
        )
    ).scalars().all()
    total = 0
    for uid in rows:
        total += await send_push(session, user_id=uid, title=title, body=body, data=data)
    return total
