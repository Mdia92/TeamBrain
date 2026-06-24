"""012 — task dependencies + task.start_date for timeline."""

from alembic import op
import sqlalchemy as sa

revision = "012_task_dependencies"
down_revision = "011_post_008_grants_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE")

    op.create_table(
        "task_dependencies",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "depends_on_task_id",
            sa.UUID(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dependency"),
    )
    op.create_index("ix_task_dependencies_org_task", "task_dependencies", ["organization_id", "task_id"])

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON task_dependencies TO coord_app")
    op.execute("ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS task_dependencies_org ON task_dependencies")
    op.execute(
        """
        CREATE POLICY task_dependencies_org ON task_dependencies
        FOR ALL TO coord_app
        USING (organization_id = app_current_org_id())
        WITH CHECK (organization_id = app_current_org_id())
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS task_dependencies_org ON task_dependencies")
    op.drop_index("ix_task_dependencies_org_task", table_name="task_dependencies")
    op.drop_table("task_dependencies")
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS start_date")
