# TeamBrain — Architecture

Multi-tenant SaaS with `organization_id` row-level security via the `coord_app` PostgreSQL role and session variables `app.current_org_id` / `app.current_user_id`.

## Stack

| Layer | Technology |
|-------|------------|
| API | FastAPI, SQLAlchemy 2.0 async, Alembic |
| Auth | JWT (15-min access + 7-day httpOnly refresh), email/password, Google OAuth |
| DB | PostgreSQL (Supabase = managed Postgres only), pgvector |
| Storage | S3-compatible `StorageBackend` |
| LLM | Gemini → Groq → Mistral fallback |
| Frontend | Next.js 14 App Router, PWA, French default UI |
| Deploy | Railway (backend), Vercel (frontend) |

## Team Brain (organizational memory)

TeamBrain is not a separate product — it is the memory and reasoning layer that connects all modules.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Meetings   │  │Field reports│  │   Tasks     │  │  WhatsApp   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       └────────────────┴────────┬───────┴────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │     MemoryService      │
                    │  memory_metadata +     │
                    │  pgvector embeddings   │
                    └───────────┬────────────┘
                                ▼
                    ┌────────────────────────┐
                    │       core.py          │
                    │ ingest / search / ask  │
                    └───────────┬────────────┘
                                ▼
                    ┌────────────────────────┐
                    │  Assistant + WhatsApp  │
                    │  accountability Q&A    │
                    └────────────────────────┘
```

### MemoryService (`app/agents/memory_service.py`)

Single read/write path for `memory_metadata`:

- `write_memory()` — episodic, semantic, commitment, decision, relationship types
- `search_memory()` — vector similarity over embeddings (Gemini + hash fallback)
- `get_who_owes_what()` — commitments and overdue accountability
- `hydrate_memory()` — context assembly for LLM prompts

### core.py (`app/agents/core.py`)

Public interface callable from any surface:

- `ingest()` — normalize and store memory from module payloads
- `search()` — semantic retrieval scoped to org
- `get_accountability()` — rules-first “who owes what” before LLM
- `ask()` — unified assistant (org-grounded RAG + cited sources)

### Module wiring

| Module | Memory writes | Notes |
|--------|---------------|-------|
| Meetings | decisions, commitments, summary | auto-creates tasks with `meeting_ai` provenance |
| Field reports | post-AI summary | after structured extraction |
| Tasks | on `done` status | episodic completion note |
| WhatsApp | commitments | questions routed via `core.ask()` |
| Assistant | — | delegates entirely to `core.ask()` |
| Event worker | episodic on reminders | rules-first loops |

### Event loops (`app/events/worker.py`)

Background jobs (rules first, memory on action):

1. Overdue task alerts (2+ days past due)
2. Commitment deadline reminders
3. Field report gap detection (expected vs submitted)

### Provenance (frontend)

Tasks created by AI show badges in Kanban (`source`: `meeting_ai` | `whatsapp` | `ai_suggestion`) with links via `source_reference`.

## Application modules

1. Onboarding & tenant setup
2. Dashboard
3. Projects & tasks (Kanban)
4. Documents & knowledge base
5. Messaging (SSE)
6. Calendar
7. Daily status
8. Field reports (offline PWA)
9. Meeting intelligence
10. WhatsApp gateway
11. AI assistant

## Migrations

| Revision | Purpose |
|----------|---------|
| `001_initial_schema` | Multi-tenant schema + RLS |
| `002_pgvector_embeddings` | Document embeddings |
| `003_memory_embedding` | Memory metadata embeddings |

## Deploy

- Backend: Railway (`backend/`, Procfile)
- Frontend: Vercel (`frontend/`)
- DB: Supabase session pooler (IPv4) or direct connection — see [local-dev.md](local-dev.md)
- Local dev: frontend `:3010`, API `:8010`
