# TeamBrain BATCH 2 — Implementation Plan

Source: product handoff. **Status: complete** (June 2026).

## Changes

| # | Scope | Summary |
|---|--------|---------|
| 1 | Multi-org | `org_memberships` table, org switcher, JWT re-issue on switch |
| 2 | Onboarding | 6-step org-first flow + `/invite/{token}` join path |
| 3 | Memory moat | Dedup, pattern promotion, decay, `/{orgSlug}/memory` page |
| 4 | Free trial | 30-day trial, read-only after expiry, pricing placeholder |
| 5 | Scalability | HNSW indexes, cursor pagination, per-org rate limits, idempotent jobs |
| 6 | Verify | Migrate, seed, full flow test |

## Commit message

```
BATCH 2: Multi-org + onboarding + memory moat + free trial + scalability
```
