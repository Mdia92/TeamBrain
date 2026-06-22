"""Batch 2 — multi-org memberships, trial, memory moat, indexes."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "005_batch2"
down_revision: str | Sequence[str] | None = "004_app_grants"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- org_memberships ---
    op.create_table(
        "org_memberships",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.UUID(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), server_default="member", nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.UniqueConstraint("user_id", "organization_id", name="uq_org_memberships_user_org"),
    )

    op.execute(
        """
        INSERT INTO org_memberships (user_id, organization_id, role, joined_at, is_active)
        SELECT id, organization_id, role, created_at, is_active FROM users
        ON CONFLICT DO NOTHING
        """
    )

    op.execute("ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE org_memberships FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY org_memberships_access ON org_memberships FOR ALL TO coord_app
        USING (
            user_id = app_current_user_id()
            OR organization_id = app_current_org_id()
        )
        WITH CHECK (organization_id = app_current_org_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON org_memberships TO coord_app")

    # --- users RLS: membership-based visibility ---
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON users")
    op.execute(
        """
        CREATE POLICY users_membership ON users FOR ALL TO coord_app
        USING (
            id = app_current_user_id()
            OR id IN (
                SELECT user_id FROM org_memberships
                WHERE organization_id = app_current_org_id() AND is_active = true
            )
        )
        WITH CHECK (id = app_current_user_id())
        """
    )

    # --- trial / pricing on organizations ---
    op.add_column(
        "organizations",
        sa.Column("pricing_tier", sa.String(20), server_default="free_trial"),
    )
    op.add_column(
        "organizations",
        sa.Column("trial_ends_at", sa.DateTime(timezone=True)),
    )
    op.execute(
        "UPDATE organizations SET trial_ends_at = created_at + INTERVAL '30 days'"
        " WHERE trial_ends_at IS NULL"
    )

    # --- memory compounding columns ---
    op.add_column("memory_metadata", sa.Column("strength", sa.Integer(), server_default="1"))
    op.add_column(
        "memory_metadata",
        sa.Column("last_reinforced_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.add_column("memory_metadata", sa.Column("resolved_at", sa.DateTime(timezone=True)))

    # --- invite inviter tracking ---
    op.add_column("organization_invites", sa.Column("invited_by", sa.UUID(), sa.ForeignKey("users.id")))

    # --- performance indexes ---
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_memory_metadata_org_type_created"
        " ON memory_metadata (organization_id, type, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_org_status_assignee_due"
        " ON tasks (organization_id, status, assignee_id, due_date)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_channel_created"
        " ON messages (channel_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_field_reports_org_mission"
        " ON field_reports (organization_id, mission_date DESC)"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_memory_metadata_embedding_hnsw
        ON memory_metadata USING hnsw (embedding vector_cosine_ops)
        """
    )

    # --- idempotency for event jobs ---
    op.create_table(
        "job_dedup_keys",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("job_name", sa.String(64), nullable=False),
        sa.Column("dedup_key", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("job_name", "dedup_key", name="uq_job_dedup"),
    )
    op.execute("GRANT SELECT, INSERT ON job_dedup_keys TO coord_app")


def downgrade() -> None:
    op.drop_table("job_dedup_keys")
    op.execute("DROP INDEX IF EXISTS ix_memory_metadata_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_field_reports_org_mission")
    op.execute("DROP INDEX IF EXISTS ix_messages_channel_created")
    op.execute("DROP INDEX IF EXISTS ix_tasks_org_status_assignee_due")
    op.execute("DROP INDEX IF EXISTS ix_memory_metadata_org_type_created")
    op.drop_column("organization_invites", "invited_by")
    op.drop_column("memory_metadata", "resolved_at")
    op.drop_column("memory_metadata", "last_reinforced_at")
    op.drop_column("memory_metadata", "strength")
    op.drop_column("organizations", "trial_ends_at")
    op.drop_column("organizations", "pricing_tier")
    op.execute("DROP POLICY IF EXISTS users_membership ON users")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON users FOR ALL TO coord_app
        USING (organization_id = app_current_org_id())
        WITH CHECK (organization_id = app_current_org_id())
        """
    )
    op.execute("DROP POLICY IF EXISTS org_memberships_access ON org_memberships")
    op.drop_table("org_memberships")
