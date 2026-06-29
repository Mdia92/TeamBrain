"""Organization URL slug helpers — readable slugs without random suffixes."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def slug_base(name: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
    return (base[:48] if base else "org")


async def unique_org_slug(session: AsyncSession, name: str, *, exclude_org_id: str | None = None) -> str:
    """Return a unique slug derived from org name (timtimol, timtimol-2, …)."""
    base = slug_base(name)
    slug = base
    n = 0
    while True:
        if exclude_org_id:
            row = (
                await session.execute(
                    text(
                        "SELECT 1 FROM organizations WHERE slug = :s AND id != CAST(:oid AS uuid)"
                    ).bindparams(s=slug, oid=exclude_org_id),
                )
            ).first()
        else:
            row = (
                await session.execute(text("SELECT 1 FROM organizations WHERE slug = :s").bindparams(s=slug))
            ).first()
        if not row:
            return slug
        n += 1
        slug = f"{base}-{n}"
