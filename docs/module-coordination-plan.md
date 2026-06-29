# Module coordination

Source: product handoff in `fdbck.txt`.

## Implemented (2026-06)

| Piece | Status |
|-------|--------|
| `module_findings` table + RLS (migration `014`) | Done |
| Document upload → Documents Agent (rules + dateparser + verify) | Done |
| Meetings → commitments/decisions/action items | Done |
| Tasks → `task_event` on create/status change | Done |
| `GET /api/org/findings` + `GET /api/org/synthesis` | Done |
| Assistant reads last 24h findings before each response | Done |
| High-confidence deadlines → `task_suggestion` pending actions | Done |
| Presigned document download (`GET /api/documents/{id}/download`) | Done |

## Schema

`module_findings(organization_id, module, finding_type, content, confidence, source_id, created_at)`

Finding types: `deadline`, `commitment`, `decision`, `action_item`, `task_event`, `entity`.

## Service

`backend/app/agents/documents_agent.py` — perceive → reason → decide → execute → verify on upload.

`backend/app/services/module_findings.py` — write, list, synthesize, meeting/task ingest helpers.

## Future

- Non-superuser DB role for RLS enforcement in production (ops)
- Dashboard synthesis widget (API ready at `/api/org/synthesis`)
- MCP tool `module_findings_list` for on-demand assistant queries

