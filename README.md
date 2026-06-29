# TeamBrain

Team coordination SaaS with agentic Team Brain — multi-tenant offline-first platform for West African field organizations. **TeamBrain** unifies projects, messaging, field reports, meetings, and WhatsApp into a single organizational memory layer with rules-first automation and org-grounded AI.

## Structure

- `backend/` — FastAPI + PostgreSQL (RLS) + Alembic + Team Brain agents
- `frontend/` — Next.js 14 PWA + Tailwind
- `docs/` — Architecture, deploy, [security](docs/security.md), local dev

## Local dev ports

TeamBrain runs on **3010** (frontend) and **8010** (API) by default so it does not conflict with other apps on 3000/8000. See **[docs/local-dev.md](docs/local-dev.md)** for full setup.

| Service | URL |
|---------|-----|
| App | http://localhost:3010 |
| API | http://localhost:8010 |
| Swagger | http://localhost:8010/docs |

## Team Brain layer

All modules write organizational memory through a single path:

- **`MemoryService`** (`backend/app/agents/memory_service.py`) — `write_memory()`, `search_memory()`, `get_who_owes_what()`, `hydrate_memory()`
- **`core.py`** (`backend/app/agents/core.py`) — public API: `ingest()`, `search()`, `get_accountability()`, `ask()`
- **Event loops** (`backend/app/events/worker.py`) — overdue tasks, commitment reminders, field-report gaps (rules first, memory writes on action)
- **Provenance** — AI-created tasks show source badges (Meeting AI, WhatsApp) in the Kanban UI

Surfaces wired to memory: meetings, field reports, tasks, WhatsApp, assistant, and background jobs.

## Quick start

### Backend

```bash
cd backend
cp .env.example .env   # fill DATABASE_URL, JWT_SECRET_KEY (see docs/local-dev.md)
pip install -e ".[dev]"
alembic upgrade head
python scripts/seed_timtimol.py   # optional — set SEED_DEMO_PASSWORD in .env first
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

### Frontend

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8010
npm install
npm run dev   # http://localhost:3010
```

**Pilot signup (production):** invite code required — configure `PILOT_INVITE_CODE` on Railway. See [docs/deploy.md](docs/deploy.md).

## Deploy

- Backend: Railway — set `CORS_ORIGINS`, `FRONTEND_URL`, `PILOT_*` (see `docs/deploy.md`)
- Frontend: Vercel — set **`NEXT_PUBLIC_API_URL`** to your Railway API URL

## Batch 2 (June 2026)

- **Multi-org** — `org_memberships`, org switcher, JWT re-issue via `POST /api/auth/switch-org`
- **Onboarding** — `/create` 6-step flow, `/invite/{token}` join path
- **Memory moat** — dedup on write, decay in search, weekly pattern job, `/{orgSlug}/memory`
- **Free trial** — 30 days, read-only after expiry, banner + `/pricing`
- **Scalability** — HNSW index, cursor pagination, per-org rate limits, idempotent jobs

## Modules

1. Onboarding & tenant setup
2. Dashboard
3. Projects & tasks (Kanban with provenance badges)
4. Documents + AI search/summarize (pgvector)
5. Messaging (SSE + polling fallback)
6. Calendar + iCal export
7. Daily status
8. Field reports (offline IndexedDB sync)
9. Meeting intelligence (transcribe → decisions, commitments, auto-tasks)
10. WhatsApp gateway (Twilio webhook + `core.ask()`)
11. AI assistant (delegates to `core.ask()`)

## Product polish (June 2026)

- **Permissions in UI** — admin vs member gates on settings, kanban, uploads
- **Clickable cards** — `TbCard` + `DetailDrawer` across list pages
- **GSAP** — page enter + list stagger animations in the app shell
- **Voice notes** — record or upload audio (documents, assistant, messages); transcribe via Gemini → Groq/OpenAI → Deepgram; indexed for Xam
- **WhatsApp brain filter** — casual/joke messages skipped for memory persistence
- **Legal (FR)** — `/legal/cgu`, `/legal/confidentialite`, `/legal/mentions-legales` + footer on all pages
- **PayDunya placeholder** — `POST /api/billing/checkout`, `POST /api/webhooks/paydunya` (wire `PAYDUNYA_API_KEY`, `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_TOKEN`)

## License

MIT — see [LICENSE](LICENSE).
