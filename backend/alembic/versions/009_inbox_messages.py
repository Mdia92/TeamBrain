"""009 — Inbox-style messages: subject, recipients, read tracking."""

from alembic import op

revision = "009_inbox_messages"
down_revision = "008_merge_field_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject TEXT")
    op.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_ids UUID[]")
    op.execute("ALTER TABLE messages ALTER COLUMN channel_id DROP NOT NULL")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS message_reads (
            message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (message_id, user_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_message_reads_user ON message_reads (user_id)")
    op.execute("ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY")
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


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS message_reads_org ON message_reads")
    op.execute("DROP TABLE IF EXISTS message_reads")
    op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS recipient_ids")
    op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS subject")
