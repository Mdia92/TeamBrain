"""Add pgvector extension and document embeddings column."""

from collections.abc import Sequence

from alembic import op

revision: str = "002_pgvector"
down_revision: str | Sequence[str] | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding vector(384)")


def downgrade() -> None:
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS embedding")
    op.execute("DROP EXTENSION IF EXISTS vector")
