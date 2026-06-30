-- TeamBrain — wipe all tenant data (production fresh start)
-- Run in Supabase → SQL Editor as postgres. IRREVERSIBLE.
--
-- Does NOT drop schema or migrations. Keeps tables, removes all rows.
-- After wipe: create first org at /create (pilot code), then invite team.

BEGIN;

TRUNCATE TABLE
  org_notifications,
  pending_actions,
  module_findings,
  task_dependencies,
  meeting_commitments,
  meeting_action_items,
  meeting_decisions,
  event_attendees,
  messages,
  channel_members,
  agent_runs,
  sync_queue,
  memory_metadata,
  daily_status,
  meetings,
  events,
  documents,
  tasks,
  milestones,
  project_members,
  automation_rules,
  channels,
  projects,
  organization_invites,
  refresh_tokens,
  org_memberships,
  audit_log,
  device_tokens,
  users,
  organizations
RESTART IDENTITY CASCADE;

COMMIT;

-- Verify empty:
-- SELECT COUNT(*) FROM organizations;
-- SELECT COUNT(*) FROM users;
