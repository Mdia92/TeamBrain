"""016 — org_notifications inbox + activity revision in settings."""

from alembic import op
import sqlalchemy as sa

revision = "016_org_notifications"
down_revision = "015_invite_short_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "org_notifications",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("module", sa.String(40), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.String(40)),
        sa.Column("entity_id", sa.UUID()),
        sa.Column("link_path", sa.String(300)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_org_notifications_user", "org_notifications", ["user_id", "created_at"])
    op.create_index("ix_org_notifications_org", "org_notifications", ["organization_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_org_notifications_org", table_name="org_notifications")
    op.drop_index("ix_org_notifications_user", table_name="org_notifications")
    op.drop_table("org_notifications")
