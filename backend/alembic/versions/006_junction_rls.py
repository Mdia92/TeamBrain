"""006 — RLS policies for junction tables (project_members, etc.)."""

from collections.abc import Sequence

from alembic import op

revision: str = "006_junction_rls"
down_revision: str | Sequence[str] | None = "005_batch2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JUNCTION_TABLES: dict[str, str] = {
    "project_members": """
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_members.project_id
              AND p.organization_id = app_current_org_id()
        )
    """,
    "channel_members": """
        EXISTS (
            SELECT 1 FROM channels c
            WHERE c.id = channel_members.channel_id
              AND c.organization_id = app_current_org_id()
        )
    """,
    "milestones": """
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = milestones.project_id
              AND p.organization_id = app_current_org_id()
        )
    """,
    "event_attendees": """
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_attendees.event_id
              AND e.organization_id = app_current_org_id()
        )
    """,
}


def upgrade() -> None:
    for table, expr in JUNCTION_TABLES.items():
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
            FOR ALL TO coord_app
            USING ({expr})
            WITH CHECK ({expr});
        """)


def downgrade() -> None:
    for table in JUNCTION_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
