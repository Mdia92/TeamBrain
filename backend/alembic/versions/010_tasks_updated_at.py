"""010 — tasks.updated_at for dashboard KPIs and sync."""

from alembic import op

revision = "010_tasks_updated_at"
down_revision = "009_inbox_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ")
    op.execute("UPDATE tasks SET updated_at = created_at WHERE updated_at IS NULL")
    op.execute("ALTER TABLE tasks ALTER COLUMN updated_at SET DEFAULT now()")
    op.execute("ALTER TABLE tasks ALTER COLUMN updated_at SET NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS updated_at")
