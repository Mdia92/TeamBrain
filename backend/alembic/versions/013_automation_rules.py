"""013 — no-code automation rules per organization."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "013_automation_rules"
down_revision = "012_task_dependencies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "automation_rules",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("trigger_type", sa.String(60), nullable=False),
        sa.Column("trigger_config", JSONB(), server_default="{}"),
        sa.Column("action_type", sa.String(60), nullable=False),
        sa.Column("action_config", JSONB(), server_default="{}"),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_automation_rules_org_trigger",
        "automation_rules",
        ["organization_id", "trigger_type", "is_active"],
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON automation_rules TO coord_app")
    op.execute("ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS automation_rules_org ON automation_rules")
    op.execute(
        """
        CREATE POLICY automation_rules_org ON automation_rules
        FOR ALL TO coord_app
        USING (organization_id = app_current_org_id())
        WITH CHECK (organization_id = app_current_org_id())
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS automation_rules_org ON automation_rules")
    op.drop_index("ix_automation_rules_org_trigger", table_name="automation_rules")
    op.drop_table("automation_rules")
