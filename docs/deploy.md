# TeamBrain — Deploy Guide

## Backend (Railway)

- Root: `backend/`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Required env (Railway)

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Supabase session pooler URL |
| `JWT_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | `https://your-app.vercel.app` |
| `FRONTEND_URL` | `https://your-app.vercel.app` (also auto-added to CORS) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GROQ_API_KEY` | Groq key (fallback LLM) |

### Pilot gate (Timtimol month — blocks public signup)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PILOT_INVITE_CODE` | (set in Railway only) | Shared team code — never shown in the UI |
| `PILOT_EMAIL_DOMAINS` | *(empty)* | Optional comma list e.g. `timtimol.org` to restrict emails |
| `PILOT_MODE` | `true` when `ENVIRONMENT=production` | Set `false` to disable domain gate |

Team members invited by email (`/invite/{token}`) join without the pilot code.

### Optional

S3 (Supabase Storage keys), Twilio, PayDunya, `FIREBASE_SERVICE_ACCOUNT_JSON`, Google OAuth (login for existing accounts only — **not required**).

Health: `GET /api/health` → `{"status":"ok"}`

## Frontend (Vercel)

- Root: `frontend/`

### Required env (Vercel)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.up.railway.app` |

**Without this, invite code validation calls `localhost:8010` and fails on the live site.**

Optional: `NEXT_PUBLIC_GOOGLE_MAPS_KEY`

## Database migrations

```bash
cd backend
alembic upgrade head
```

Optional local demo data: `SEED_DEMO_PASSWORD=... python scripts/seed_timtimol.py` (never commit password).

## Local development

Ports **3010** (UI) and **8010** (API). See [local-dev.md](local-dev.md).

Pilot gate is **off** in `ENVIRONMENT=development` — any email works with invite code for testing.
