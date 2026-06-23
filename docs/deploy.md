# TeamBrain — Deploy Guide

## Backend (Railway)

- Root: `backend/`
- Procfile: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Required env: `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `ENVIRONMENT=production`
- Optional: `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, S3 and Twilio vars (see `backend/.env.example`)

Health check: `GET /api/health` → `{"status":"ok","service":"teambrain-api"}`

## Frontend (Vercel)

- Root: `frontend/`
- Env: `NEXT_PUBLIC_API_URL` (production API URL)
- Optional: `NEXT_PUBLIC_GOOGLE_MAPS_KEY` for field-report maps

## Database migrations

Run after first deploy or schema changes:

```bash
cd backend
alembic upgrade head
python scripts/seed_timtimol.py   # optional demo data (Timtimol AIS)
```

## Event worker (APScheduler)

The API starts **APScheduler** automatically on boot:

| Job | Schedule |
|-----|----------|
| Overdue task alerts | Every 6 hours |
| Commitment reminders | Daily 08:00 |
| Field report gaps | Monday 07:00 |

Manual trigger (admin): `POST /api/events/run-checks?weekly=true`

Task status changes and meeting processing also trigger immediate org-scoped checks.

## PostgreSQL RLS role setup

After migrations, ensure the app DB user can assume `coord_app`:

```sql
-- Created by migration 004_app_grants
GRANT coord_app TO app_user;
GRANT app_user TO postgres;  -- or your Railway/Supabase login role

-- Production: create a dedicated login role
CREATE ROLE teambrain_login LOGIN PASSWORD 'your_secure_password';
GRANT app_user TO teambrain_login;
-- Use teambrain_login in DATABASE_URL (not superuser postgres)
```

Enable pgvector (also run at API startup):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Local development

TeamBrain uses ports **3010** (frontend) and **8010** (API) by default. See [local-dev.md](local-dev.md).

```bash
# Terminal 1 — API
cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8010

# Terminal 2 — UI
cd frontend && npm run dev
```

Demo login after seed: `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` from `backend/.env` (never commit).
