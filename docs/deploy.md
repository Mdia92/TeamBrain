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

## Event worker

Schedule `POST /api/events/run` (or invoke worker functions from a cron job) for Team Brain closed loops: overdue tasks, commitment reminders, field-report gaps.

Protect this endpoint in production (API key, Railway cron secret, or internal network only).

## Local development

```bash
# Terminal 1 — API
cd backend && uvicorn app.main:app --reload

# Terminal 2 — UI
cd frontend && npm run dev
```

Demo login after seed: `amadou@timtimol.sn` / `Timtimol2026!`
