"""015 — short_code on organization_invites for team join codes."""

from alembic import op
import sqlalchemy as sa

revision = "015_invite_short_code"
down_revision = "014_module_findings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organization_invites", sa.Column("short_code", sa.String(12), nullable=True))
    op.execute(
        """
        UPDATE organization_invites
        SET short_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
        WHERE short_code IS NULL
        """
    )
    op.alter_column("organization_invites", "short_code", nullable=False)
    op.create_index("ix_org_invites_short_code", "organization_invites", ["short_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_org_invites_short_code", table_name="organization_invites")
    op.drop_column("organization_invites", "short_code")
