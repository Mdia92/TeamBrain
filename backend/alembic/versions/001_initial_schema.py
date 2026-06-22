"""Initial schema — multi-tenant team coordination with RLS."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "001_initial"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_TABLES = [
    "users",
    "organization_invites",
    "projects",
    "tasks",
    "documents",
    "channels",
    "messages",
    "events",
    "field_reports",
    "meetings",
    "daily_status",
    "memory_metadata",
    "agent_runs",
    "sync_queue",
]


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table(
        "organizations",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(80), unique=True, nullable=False),
        sa.Column("plan", sa.String(20), server_default="free"),
        sa.Column("settings", postgresql.JSONB(), server_default="{}"),
        sa.Column("logo_url", sa.Text()),
        sa.Column("primary_color", sa.String(20)),
        sa.Column("language", sa.String(10), server_default="fr"),
        sa.Column("owner_id", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("phone_hash", sa.String(64)),
        sa.Column("role", sa.String(20), server_default="member"),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("onboarding_completed", sa.Boolean(), server_default="false"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("google_sub", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "organization_invites",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), server_default="member"),
        sa.Column("token", sa.String(64), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("last_used_ip", sa.String(45)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("entity_type", sa.String(64)),
        sa.Column("actor_user_id", sa.UUID()),
        sa.Column("payload_sha256", sa.String(64)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.String(512)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("client_name", sa.String(200)),
        sa.Column("description", sa.Text()),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("start_date", sa.Date()),
        sa.Column("end_date", sa.Date()),
        sa.Column("budget_allocated", sa.Float()),
        sa.Column("budget_spent", sa.Float()),
        sa.Column("project_type", sa.String(60)),
        sa.Column("created_by", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "project_members",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("role_in_project", sa.String(20), server_default="member"),
        sa.UniqueConstraint("project_id", "user_id"),
    )

    op.create_table(
        "milestones",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("due_date", sa.Date()),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("description", sa.Text()),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("assignee_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("due_date", sa.Date()),
        sa.Column("priority", sa.String(10), server_default="medium"),
        sa.Column("status", sa.String(20), server_default="todo"),
        sa.Column("source", sa.String(20), server_default="manual"),
        sa.Column("source_reference", sa.String(120)),
        sa.Column("created_by", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("file_url", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(120)),
        sa.Column("file_size", sa.Integer()),
        sa.Column("ocr_text", sa.Text()),
        sa.Column("tags", postgresql.JSONB(), server_default="[]"),
        sa.Column("ai_summary", sa.Text()),
        sa.Column("uploaded_by", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "channels",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("is_direct", sa.Boolean(), server_default="false"),
        sa.Column("created_by", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "channel_members",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("channel_id", sa.UUID(), sa.ForeignKey("channels.id")),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.UniqueConstraint("channel_id", "user_id"),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("channel_id", sa.UUID(), sa.ForeignKey("channels.id")),
        sa.Column("sender_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("attachments", postgresql.JSONB(), server_default="[]"),
        sa.Column("is_pinned", sa.Boolean(), server_default="false"),
        sa.Column("thread_parent_id", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "events",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("event_type", sa.String(40), server_default="meeting"),
        sa.Column("start_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(300)),
        sa.Column("description", sa.Text()),
        sa.Column("meeting_id", sa.UUID()),
        sa.Column("created_by", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "event_attendees",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("event_id", sa.UUID(), sa.ForeignKey("events.id")),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(20), server_default="confirmed"),
        sa.UniqueConstraint("event_id", "user_id"),
    )

    op.create_table(
        "field_reports",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("submitted_by", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("mission_date", sa.Date(), nullable=False),
        sa.Column("location_name", sa.String(200)),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("report_type", sa.String(60)),
        sa.Column("description", sa.Text()),
        sa.Column("photos", postgresql.JSONB(), server_default="[]"),
        sa.Column("structured_data", postgresql.JSONB(), server_default="{}"),
        sa.Column("ai_summary", sa.Text()),
        sa.Column("recommendations", sa.Text()),
        sa.Column("synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "meetings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), sa.ForeignKey("projects.id")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer()),
        sa.Column("audio_url", sa.Text()),
        sa.Column("transcript_text", sa.Text()),
        sa.Column("ai_summary", sa.Text()),
        sa.Column("platform_source", sa.String(30), server_default="in_person"),
        sa.Column("processing_status", sa.String(20), server_default="pending"),
        sa.Column("created_by", sa.UUID()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "meeting_decisions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("meeting_id", sa.UUID(), sa.ForeignKey("meetings.id")),
        sa.Column("decision_text", sa.Text(), nullable=False),
        sa.Column("decided_by", sa.String(120)),
        sa.Column("logged_to_memory", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "meeting_action_items",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("meeting_id", sa.UUID(), sa.ForeignKey("meetings.id")),
        sa.Column("task_id", sa.UUID(), sa.ForeignKey("tasks.id")),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("assignee_id", sa.UUID()),
        sa.Column("due_date", sa.Date()),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("follow_up_sent", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "meeting_commitments",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("meeting_id", sa.UUID(), sa.ForeignKey("meetings.id")),
        sa.Column("committed_by", sa.UUID()),
        sa.Column("commitment_text", sa.Text(), nullable=False),
        sa.Column("deadline", sa.Date()),
        sa.Column("deliverable_type", sa.String(30)),
        sa.Column("is_fulfilled", sa.Boolean(), server_default="false"),
        sa.Column("reminder_sent", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "daily_status",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status_text", sa.Text(), nullable=False),
        sa.Column("location_name", sa.String(200)),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("source", sa.String(20), server_default="app"),
        sa.Column("project_id", sa.UUID()),
    )

    op.create_table(
        "memory_metadata",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("entity_type", sa.String(80)),
        sa.Column("entity_id", sa.UUID()),
        sa.Column("note", sa.Text()),
        sa.Column("source_module", sa.String(120)),
        sa.Column("source_id", sa.UUID()),
        sa.Column("confidence_score", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("agent_type", sa.String(60), nullable=False),
        sa.Column("input", postgresql.JSONB()),
        sa.Column("output", postgresql.JSONB()),
        sa.Column("confidence", sa.Float()),
        sa.Column("sources_used", postgresql.JSONB()),
        sa.Column("model", sa.String(120)),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "sync_queue",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("client_id", sa.String(120), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("synced_at", sa.DateTime(timezone=True)),
    )

    # RLS helper functions
    op.execute("""
        CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid AS $$
          SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
        $$ LANGUAGE sql STABLE;
    """)
    op.execute("""
        CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
          SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
        $$ LANGUAGE sql STABLE;
    """)

    # coord_app role
    op.execute("""
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'coord_app') THEN
            CREATE ROLE coord_app NOINHERIT NOBYPASSRLS;
          END IF;
        END $$;
    """)
    op.execute("GRANT USAGE ON SCHEMA public TO coord_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO coord_app")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO coord_app")

    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
            FOR ALL TO coord_app
            USING (organization_id = app_current_org_id())
            WITH CHECK (organization_id = app_current_org_id());
        """)

    # organizations: users can only see their own org
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE organizations FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY org_self ON organizations FOR ALL TO coord_app
        USING (id = app_current_org_id())
        WITH CHECK (id = app_current_org_id());
    """)


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute("DROP POLICY IF EXISTS org_self ON organizations")
    op.execute("DROP FUNCTION IF EXISTS app_current_org_id()")
    op.execute("DROP FUNCTION IF EXISTS app_current_user_id()")
    op.drop_table("sync_queue")
    op.drop_table("agent_runs")
    op.drop_table("memory_metadata")
    op.drop_table("daily_status")
    op.drop_table("meeting_commitments")
    op.drop_table("meeting_action_items")
    op.drop_table("meeting_decisions")
    op.drop_table("meetings")
    op.drop_table("field_reports")
    op.drop_table("event_attendees")
    op.drop_table("events")
    op.drop_table("messages")
    op.drop_table("channel_members")
    op.drop_table("channels")
    op.drop_table("documents")
    op.drop_table("tasks")
    op.drop_table("milestones")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("audit_log")
    op.drop_table("refresh_tokens")
    op.drop_table("organization_invites")
    op.drop_table("users")
    op.drop_table("organizations")
