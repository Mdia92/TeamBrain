"""008 — Merge field_reports into documents + pending_actions table."""

from alembic import op

revision = "008_merge_field_reports"
down_revision = "007_device_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type VARCHAR(30) NOT NULL DEFAULT 'document'")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS location_name TEXT")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS mission_date DATE")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id)")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS text_tags TEXT[]")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS field_reports_backup (
            LIKE field_reports INCLUDING ALL
        )
        """
    )
    op.execute("INSERT INTO field_reports_backup SELECT * FROM field_reports")

    op.execute(
        """
        INSERT INTO documents (
            id, organization_id, project_id, title, file_url, content_type, file_size,
            ocr_text, tags, ai_summary, uploaded_by, created_at, doc_type,
            gps_latitude, gps_longitude, location_name, mission_date, synced_at, submitted_by, text_tags
        )
        SELECT
            fr.id, fr.organization_id, fr.project_id,
            COALESCE(NULLIF(fr.location_name, ''), 'Rapport terrain'),
            'inline://field-report/' || fr.id::text,
            'text/plain', 0,
            fr.description,
            fr.photos,
            fr.ai_summary,
            fr.submitted_by,
            fr.created_at,
            'field_report',
            fr.latitude, fr.longitude, fr.location_name, fr.mission_date, fr.synced_at, fr.submitted_by,
            CASE WHEN fr.report_type IS NOT NULL THEN ARRAY[fr.report_type] ELSE NULL END
        FROM field_reports fr
        WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = fr.id)
        """
    )

    op.execute(
        """
        UPDATE memory_metadata
        SET entity_type = 'document', source_module = 'documents'
        WHERE entity_type = 'field_report'
        """
    )

    op.execute("DROP TABLE IF EXISTS field_reports CASCADE")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pending_actions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            action_type VARCHAR(60) NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}',
            suggested_by VARCHAR(40) NOT NULL DEFAULT 'assistant',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            reviewed_by UUID REFERENCES users(id),
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_pending_actions_org_status ON pending_actions(organization_id, status)")
    op.execute("ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        DO $$ BEGIN
            CREATE POLICY pending_actions_org ON pending_actions
                USING (organization_id = current_setting('app.organization_id', true)::uuid);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS pending_actions CASCADE")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS field_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL,
            project_id UUID REFERENCES projects(id),
            submitted_by UUID REFERENCES users(id),
            mission_date DATE NOT NULL,
            location_name VARCHAR(200),
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            report_type VARCHAR(60),
            description TEXT,
            photos JSONB DEFAULT '[]',
            structured_data JSONB DEFAULT '{}',
            ai_summary TEXT,
            recommendations TEXT,
            synced_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        """
        INSERT INTO field_reports (
            id, organization_id, project_id, submitted_by, mission_date, location_name,
            latitude, longitude, description, photos, ai_summary, synced_at, created_at
        )
        SELECT
            d.id, d.organization_id, d.project_id, d.submitted_by, COALESCE(d.mission_date, CURRENT_DATE),
            d.location_name, d.gps_latitude, d.gps_longitude, d.ocr_text, d.tags, d.ai_summary,
            d.synced_at, d.created_at
        FROM documents d
        WHERE d.doc_type = 'field_report'
        """
    )
    op.execute("DELETE FROM documents WHERE doc_type = 'field_report'")
    op.execute(
        """
        UPDATE memory_metadata
        SET entity_type = 'field_report', source_module = 'field_reports'
        WHERE entity_type = 'document' AND source_module = 'documents'
        """
    )
    op.execute("DROP TABLE IF EXISTS field_reports_backup")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS doc_type")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS gps_latitude")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS gps_longitude")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS location_name")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS mission_date")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS synced_at")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS submitted_by")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS text_tags")
