"""S3-compatible storage backend."""

import logging

import aioboto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.storage.base import StorageBackend

logger = logging.getLogger(__name__)


def _s3_credentials_valid() -> bool:
    """Reject Supabase anon/service JWT tokens mistakenly pasted as S3 keys."""
    if not (settings.s3_bucket and settings.s3_access_key and settings.s3_secret_key):
        return False
    access = settings.s3_access_key.strip()
    secret = settings.s3_secret_key.strip()
    if access.startswith("eyJ") or secret.startswith("eyJ"):
        return False
    if len(access) > 128 or len(secret) > 256:
        return False
    return True


class S3StorageBackend(StorageBackend):
    def __init__(self) -> None:
        self._session = aioboto3.Session()

    def _client(self):
        boto_config = None
        if settings.s3_use_path_style:
            boto_config = Config(s3={"addressing_style": "path"})
        return self._session.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region or None,
            aws_access_key_id=settings.s3_access_key or None,
            aws_secret_access_key=settings.s3_secret_key or None,
            config=boto_config,
        )

    def _configured(self) -> bool:
        return _s3_credentials_valid()

    async def upload(self, key: str, data: bytes, content_type: str | None = None) -> str:
        if not self._configured():
            logger.info("S3 not configured — storing locally: %s", key)
            return f"local://{key}"
        extra = {"ContentType": content_type} if content_type else {}
        try:
            async with self._client() as client:
                await client.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, **extra)
            return f"s3://{settings.s3_bucket}/{key}"
        except (ClientError, BotoCoreError) as exc:
            if settings.environment == "development":
                logger.warning("S3 upload failed (%s) — local fallback for %s", exc, key)
                return f"local://{key}"
            raise

    async def download(self, key: str) -> bytes:
        if not self._configured():
            return b""
        try:
            async with self._client() as client:
                response = await client.get_object(Bucket=settings.s3_bucket, Key=key)
                async with response["Body"] as stream:
                    return await stream.read()
        except (ClientError, BotoCoreError):
            return b""

    async def delete(self, key: str) -> None:
        if not self._configured():
            return
        try:
            async with self._client() as client:
                await client.delete_object(Bucket=settings.s3_bucket, Key=key)
        except (ClientError, BotoCoreError):
            pass

    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        if not self._configured():
            return f"/api/files/{key}"
        try:
            async with self._client() as client:
                return await client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.s3_bucket, "Key": key},
                    ExpiresIn=expires_in,
                )
        except (ClientError, BotoCoreError):
            return f"/api/files/{key}"


def get_storage() -> StorageBackend:
    return S3StorageBackend()
