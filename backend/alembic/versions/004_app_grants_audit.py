"""004 — app DB role grants + audit_log organization_id."""

from alembic import op

revision = "004_app_grants"
down_revision = "003_memory_embedding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
            CREATE ROLE app_user NOLOGIN;
          END IF;
        END $$;
    """)
    op.execute("GRANT coord_app TO app_user")
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
            GRANT app_user TO postgres;
          END IF;
        END $$;
    """)
    op.execute("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS organization_id UUID")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log (organization_id, created_at DESC)
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE audit_log DROP COLUMN IF EXISTS organization_id")
    op.execute("REVOKE app_user FROM postgres")
    op.execute("REVOKE coord_app FROM app_user")
    op.execute("DROP ROLE IF EXISTS app_user")
