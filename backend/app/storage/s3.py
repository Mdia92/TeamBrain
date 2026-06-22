"""S3-compatible storage backend."""

import aioboto3

from app.config import settings
from app.storage.base import StorageBackend


class S3StorageBackend(StorageBackend):
    def __init__(self) -> None:
        self._session = aioboto3.Session()

    def _client(self):
        return self._session.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key or None,
            aws_secret_access_key=settings.s3_secret_key or None,
        )

    def _configured(self) -> bool:
        return bool(settings.s3_bucket and settings.s3_access_key)

    async def upload(self, key: str, data: bytes, content_type: str | None = None) -> str:
        if not self._configured():
            return f"local://{key}"
        extra = {"ContentType": content_type} if content_type else {}
        async with self._client() as client:
            await client.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, **extra)
        return f"s3://{settings.s3_bucket}/{key}"

    async def download(self, key: str) -> bytes:
        if not self._configured():
            return b""
        async with self._client() as client:
            response = await client.get_object(Bucket=settings.s3_bucket, Key=key)
            async with response["Body"] as stream:
                return await stream.read()

    async def delete(self, key: str) -> None:
        if not self._configured():
            return
        async with self._client() as client:
            await client.delete_object(Bucket=settings.s3_bucket, Key=key)

    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        if not self._configured():
            return f"/api/files/{key}"
        async with self._client() as client:
            return await client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.s3_bucket, "Key": key},
                ExpiresIn=expires_in,
            )


def get_storage() -> StorageBackend:
    return S3StorageBackend()
