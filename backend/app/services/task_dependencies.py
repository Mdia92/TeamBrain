"""Task dependency validation helpers."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def unresolved_dependency_titles(
    session: AsyncSession,
    org_id: str,
    task_id: str,
) -> list[str]:
    rows = (
        await session.execute(
            text(
                "SELECT dep.title"
                " FROM task_dependencies td"
                " JOIN tasks dep ON dep.id = td.depends_on_task_id"
                " WHERE td.task_id = CAST(:tid AS uuid)"
                " AND td.organization_id = CAST(:oid AS uuid)"
                " AND dep.status != 'done'"
            ).bindparams(tid=task_id, oid=org_id),
        )
    ).scalars().all()
    return list(rows)


async def dependency_would_cycle(
    session: AsyncSession,
    org_id: str,
    task_id: str,
    depends_on_task_id: str,
) -> bool:
    if task_id == depends_on_task_id:
        return True
    visited: set[str] = {depends_on_task_id}
    queue = [depends_on_task_id]
    while queue:
        current = queue.pop(0)
        parents = (
            await session.execute(
                text(
                    "SELECT depends_on_task_id::text"
                    " FROM task_dependencies"
                    " WHERE task_id = CAST(:tid AS uuid)"
                    " AND organization_id = CAST(:oid AS uuid)"
                ).bindparams(tid=current, oid=org_id),
            )
        ).scalars().all()
        for parent_id in parents:
            if parent_id == task_id:
                return True
            if parent_id not in visited:
                visited.add(parent_id)
                queue.append(parent_id)
    return False
