"""Add pgvector embedding column to memory_metadata."""

from collections.abc import Sequence

from alembic import op

revision: str = "003_memory_embedding"
down_revision: str | Sequence[str] | None = "002_pgvector"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE memory_metadata ADD COLUMN IF NOT EXISTS embedding vector(384)")


def downgrade() -> None:
    op.execute("ALTER TABLE memory_metadata DROP COLUMN IF EXISTS embedding")
