"""Device push tokens for FCM."""

from alembic import op

revision = "007_device_tokens"
down_revision = "006_junction_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS device_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            token TEXT NOT NULL,
            platform VARCHAR(16) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, token)
        );
        CREATE INDEX IF NOT EXISTS ix_device_tokens_user_id ON device_tokens(user_id);
        ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
        CREATE POLICY device_tokens_org ON device_tokens
            USING (organization_id = current_setting('app.organization_id', true)::uuid);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS device_tokens CASCADE;")
