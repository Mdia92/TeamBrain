"""Append-only audit middleware."""

from __future__ import annotations

import hashlib

from sqlalchemy import text

from app.auth.jwt import decode_token
from app.db.session import SessionLocal

_STATE_CHANGING = {"POST", "PUT", "PATCH", "DELETE"}


class AuditMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("method") not in _STATE_CHANGING:
            await self.app(scope, receive, send)
            return

        chunks: list[bytes] = []
        while True:
            message = await receive()
            if message["type"] == "http.request":
                chunks.append(message.get("body", b""))
                if not message.get("more_body", False):
                    break
        body = b"".join(chunks)

        try:
            await self._write(scope, body)
        except Exception:
            pass

        replayed = False

        async def receive_replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, receive_replay, send)

    async def _write(self, scope, body: bytes) -> None:
        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        method, path = scope.get("method"), scope.get("path", "")
        actor = None
        auth = headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            payload = decode_token(auth.split(" ", 1)[1])
            if payload and payload.get("type") == "access":
                actor = payload.get("sub")
        client = scope.get("client")
        ip = client[0] if client else None
        entity = (path.strip("/").split("/")[0] or "root")[:64]
        async with SessionLocal() as session:
            await session.execute(
                text(
                    "INSERT INTO audit_log (action, entity_type, actor_user_id,"
                    " payload_sha256, ip_address, user_agent) VALUES"
                    " (:a, :e, CAST(:u AS uuid), :p, CAST(:ip AS inet), :ua)"
                ).bindparams(
                    a=f"{method} {path}"[:128],
                    e=entity,
                    u=actor,
                    p=hashlib.sha256(body).hexdigest(),
                    ip=ip,
                    ua=headers.get("user-agent", "")[:512],
                ),
            )
            await session.commit()
