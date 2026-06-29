"""014 — module_findings coordination layer."""

from alembic import op
import sqlalchemy as sa

revision = "014_module_findings"
down_revision = "013_automation_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "module_findings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("module", sa.String(40), nullable=False),
        sa.Column("finding_type", sa.String(40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_module_findings_org_created",
        "module_findings",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_module_findings_org_module",
        "module_findings",
        ["organization_id", "module", "finding_type"],
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON module_findings TO coord_app")
    op.execute("ALTER TABLE module_findings ENABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS module_findings_org ON module_findings")
    op.execute(
        """
        CREATE POLICY module_findings_org ON module_findings
        FOR ALL TO coord_app
        USING (organization_id = app_current_org_id())
        WITH CHECK (organization_id = app_current_org_id())
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS module_findings_org ON module_findings")
    op.drop_index("ix_module_findings_org_module", table_name="module_findings")
    op.drop_index("ix_module_findings_org_created", table_name="module_findings")
    op.drop_table("module_findings")
