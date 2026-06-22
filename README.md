# TeamBrain

Team coordination SaaS with agentic Team Brain — multi-tenant offline-first platform for West African field organizations. **TeamBrain** unifies projects, messaging, field reports, meetings, and WhatsApp into a single organizational memory layer with rules-first automation and org-grounded AI.

## Structure

- `backend/` — FastAPI + PostgreSQL (RLS) + Alembic + Team Brain agents
- `frontend/` — Next.js 14 PWA + Tailwind
- `docs/` — Architecture, deploy, and data contracts

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
cp .env.example .env   # fill DATABASE_URL, JWT_SECRET_KEY
pip install -e ".[dev]"
alembic upgrade head
python scripts/seed_timtimol.py
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Demo login after seed: `amadou@timtimol.sn` / `Timtimol2026!`

## Deploy

- Backend: Railway (`backend/`, see `docs/deploy.md`)
- Frontend: Vercel (`frontend/`)

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

## License

MIT — see [LICENSE](LICENSE).
