"""Parse internal storage URLs (s3://, local://)."""

from __future__ import annotations


def storage_key_from_url(file_url: str | None) -> tuple[str, str] | None:
    if not file_url:
        return None
    url = file_url.strip()
    if url.startswith("s3://"):
        rest = url[5:]
        if "/" not in rest:
            return None
        bucket, key = rest.split("/", 1)
        return bucket, key
    if url.startswith("local://"):
        return "local", url[8:]
    return None
