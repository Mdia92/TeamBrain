"""017 — optional category for team announcements (inbox broadcasts)."""

revision = "017_message_category"
down_revision = "016_org_notifications"

from alembic import op


def upgrade() -> None:
    op.execute(
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'info'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS category")
