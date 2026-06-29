"""JWT issue/verify + refresh token persistence."""

from __future__ import annotations

import hashlib
import ipaddress
import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.sql_compat import is_sqlite, now_sql

JWT_ISSUER = "teambrain-api"


def _now() -> datetime:
    return datetime.now(UTC)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _safe_inet(ip: str | None) -> str | None:
    if not ip:
        return None
    try:
        ipaddress.ip_address(ip)
        return ip
    except ValueError:
        return None


def create_access_token(user_id, organization_id, role: str) -> str:
    now = _now()
    exp = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "org": str(organization_id),
        "role": role,
        "type": "access",
        "iss": JWT_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def create_refresh_token(session: AsyncSession, user_id, ip: str | None = None) -> str:
    now = _now()
    exp = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iss": JWT_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    if is_sqlite():
        await session.execute(
            text(
                f"INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, last_used_ip)"
                f" VALUES (:id, :uid, :th, :exp, {now_sql()}, :ip)"
            ).bindparams(
                id=str(uuid.uuid4()),
                uid=str(user_id),
                th=_hash(token),
                exp=exp.isoformat(),
                ip=_safe_inet(ip),
            ),
        )
    else:
        await session.execute(
            text(
                "INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, last_used_ip)"
                " VALUES (CAST(:uid AS uuid), :th, :exp, now(), CAST(:ip AS inet))"
            ).bindparams(uid=str(user_id), th=_hash(token), exp=exp, ip=_safe_inet(ip)),
        )
    await session.commit()
    return token


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iss", "sub"]},
        )
        return payload
    except JWTError:
        return None


async def refresh_token_is_valid(session: AsyncSession, token: str) -> bool:
    expiry_cmp = f"expires_at > {now_sql()}" if is_sqlite() else "expires_at > now()"
    row = (
        await session.execute(
            text(
                f"SELECT 1 FROM refresh_tokens WHERE token_hash = :th"
                f" AND revoked_at IS NULL AND {expiry_cmp}"
            ).bindparams(th=_hash(token)),
        )
    ).first()
    return row is not None


async def revoke_refresh_token(session: AsyncSession, token: str) -> None:
    revoked_at = now_sql()
    await session.execute(
        text(
            f"UPDATE refresh_tokens SET revoked_at = {revoked_at}"
            " WHERE token_hash = :th AND revoked_at IS NULL"
        ).bindparams(th=_hash(token)),
    )
    await session.commit()
