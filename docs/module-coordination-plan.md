# Module coordination — product backlog (not started)

Source: product handoff in `fdbck.txt`. **Security work is separate** — see [security.md](security.md).

## Goal

Wire modules through a shared `module_findings` layer so the assistant synthesizes cross-module context.

## Planned pieces

1. **Documents** — on upload, extract entities → `module_findings`
2. **Meetings** — commitments/decisions → `module_findings`
3. **Tasks** — status events → `module_findings`
4. **Assistant** — `GET /api/org/findings`, synthesis before each response
5. **Admin** — pending task suggestions from findings → one-click approve

## Schema (draft)

`module_findings(org_id, module, finding_type, content, confidence, source_id, created_at)`

## Status

Not implemented. Signup/production pilot takes priority.
