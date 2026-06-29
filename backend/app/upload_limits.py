"""Bounded reads for multipart uploads (DoS protection)."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile, status

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
_CHUNK = 1024 * 1024


async def read_upload_bounded(
    upload: UploadFile,
    *,
    max_bytes: int = MAX_UPLOAD_BYTES,
) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        part = await upload.read(_CHUNK)
        if not part:
            break
        total += len(part)
        if total > max_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"Fichier trop volumineux (max {max_bytes // (1024 * 1024)} Mo)",
            )
        chunks.append(part)
    return b"".join(chunks)
