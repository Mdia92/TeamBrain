"""Password hashing — bcrypt cost 12."""

from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return _ctx.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _ctx.verify(password, password_hash)
