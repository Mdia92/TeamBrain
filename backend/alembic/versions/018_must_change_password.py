"""018 — force password change after invite signup (initial code as temp password)."""

revision = "018_must_change_password"
down_revision = "017_message_category"

from alembic import op


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS must_change_password")
