"""011 — Grants + RLS fix for tables added after initial coord_app grants."""

from alembic import op

revision = "011_post_008_grants_rls"
down_revision = "010_tasks_updated_at"
branch_labels = None
depends_on = None

_TABLES = ("pending_actions", "device_tokens", "message_reads")


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO coord_app")

    op.execute("DROP POLICY IF EXISTS pending_actions_org ON pending_actions")
    op.execute(
        """
        CREATE POLICY pending_actions_org ON pending_actions
        FOR ALL TO coord_app
        USING (organization_id = app_current_org_id())
        WITH CHECK (organization_id = app_current_org_id())
        """
    )

    op.execute("DROP POLICY IF EXISTS device_tokens_org ON device_tokens")
    op.execute(
        """
        CREATE POLICY device_tokens_org ON device_tokens
        FOR ALL TO coord_app
        USING (organization_id = app_current_org_id())
        WITH CHECK (organization_id = app_current_org_id())
        """
    )

    op.execute("DROP POLICY IF EXISTS message_reads_org ON message_reads")
    op.execute(
        """
        CREATE POLICY message_reads_org ON message_reads
        FOR ALL TO coord_app
        USING (
            EXISTS (
                SELECT 1 FROM messages m
                WHERE m.id = message_reads.message_id
                AND m.organization_id = app_current_org_id()
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS message_reads_org ON message_reads")
    op.execute(
        """
        CREATE POLICY message_reads_org ON message_reads
        USING (
            EXISTS (
                SELECT 1 FROM messages m
                WHERE m.id = message_reads.message_id
                AND m.organization_id = current_setting('app.organization_id', true)::uuid
            )
        )
        """
    )
    op.execute("DROP POLICY IF EXISTS device_tokens_org ON device_tokens")
    op.execute(
        """
        CREATE POLICY device_tokens_org ON device_tokens
        USING (organization_id = current_setting('app.organization_id', true)::uuid)
        """
    )
    op.execute("DROP POLICY IF EXISTS pending_actions_org ON pending_actions")
    op.execute(
        """
        CREATE POLICY pending_actions_org ON pending_actions
        USING (organization_id = current_setting('app.organization_id', true)::uuid)
        """
    )
    for table in _TABLES:
        op.execute(f"REVOKE ALL ON {table} FROM coord_app")
