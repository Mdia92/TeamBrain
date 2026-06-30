# TeamBrain — Deploy Guide

## Backend (Railway)

- Root: `backend/` (must be set in Railway service settings)
- Start: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Requires `backend/requirements.txt`** — Railpack runs `pip install -r requirements.txt` at build time. Without it you get `uvicorn: command not found` and the container exits immediately.
- Python **3.12** (`.python-version` in `backend/`)
- `railway.toml` runs `alembic upgrade head` on each deploy (release phase)

After deploy, check `GET /api/health` — should include `db_migration` (latest: `018_must_change_password`) and `org_memberships_table: true`.

### Required env (Railway)

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Supabase session pooler URL — **one line, no trailing newline** |
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
- Node **22.x** (from `package.json` `engines`; required by Capacitor 8 CLI)

### Required env (Vercel)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.up.railway.app` (must include `https://`) |

**Common mistake:** `teambrain-production.up.railway.app` without `https://` makes the browser call  
`https://your-app.vercel.app/teambrain-production.up.railway.app/...` → 404.

**Without a valid API URL, invite code validation fails on the live site.**

Optional: `NEXT_PUBLIC_GOOGLE_MAPS_KEY`

Build uses `npm ci` with dependency overrides (`glob`, `rimraf`) to cut most deprecated-package noise in install logs. A few `eslint@8` warnings remain until a future Next.js 15 / ESLint 9 upgrade.

## Production diagnostics (no guessing)

### 1. API reachable?

Open in a browser tab (not DevTools):

`https://YOUR-RAILWAY-URL.up.railway.app/api/health`

Expected: `{"status":"ok","service":"teambrain-api"}`

If you see **502** or timeout → fix **Railway** first. Common deploy log errors:

```
uvicorn: command not found
```
→ missing `backend/requirements.txt` or wrong Railway root directory.

```
InvalidCatalogNameError: database "postgres\n" does not exist
```
→ `DATABASE_URL` has a **line break** at the end. Re-paste as a single line in Railway Variables (no Enter after the URL). Invite validation still works without DB; signup/login fail until fixed.

### 2. Frontend calling the right URL?

On https://your-app.vercel.app/create → DevTools → **Network** → submit invite code.

Correct: `POST https://YOUR-RAILWAY-URL.up.railway.app/api/auth/validate-invite-code`

Wrong (relative path bug or stale cache):  
`POST https://your-app.vercel.app/YOUR-RAILWAY-URL.up.railway.app/api/...`

**Stale service worker:** if the script name is an old `layout-*.js` that 404s on Vercel, unregister SW (Application → Service Workers → Unregister) and hard-refresh. Current deploys must load a live `layout-*.js` (200).

### 3. Vercel env

`NEXT_PUBLIC_API_URL` must be `https://your-api.up.railway.app` (with `https://`). Redeploy after changing.

### 4. Railway CORS

`CORS_ORIGINS` and `FRONTEND_URL` must include `https://your-app.vercel.app`.

## Platform wiring (recommended)

One GitHub repo, three services — **do not** deploy the app from Supabase.

```
GitHub: Mdia92/TeamBrain (main)
    │
    ├── Railway  → backend/     → FastAPI + Alembic migrations
    │                 │
    │                 └── DATABASE_URL ──► Supabase Postgres (data only)
    │
    └── Vercel   → frontend/    → Next.js PWA
                      │
                      └── NEXT_PUBLIC_API_URL ──► Railway public URL
```

| Service | Connect to GitHub? | Role |
|---------|-------------------|------|
| **Railway** | Yes — repo `TeamBrain`, root **`backend/`**, branch `main`, auto-deploy | API, JWT auth, `alembic upgrade head` on each deploy |
| **Vercel** | Yes — same repo, root **`frontend/`**, branch `main`, auto-deploy | UI |
| **Supabase** | **Optional** — see below | Managed Postgres (+ optional Storage, Edge Functions) |

**Supabase uses only Postgres** for TeamBrain (not Supabase Auth). `DATABASE_URL` on Railway points at the Supabase **session pooler** URL.

### Should Supabase link to GitHub?

**Not required** for the core app. Railway already applies schema via Alembic on deploy.

Link Supabase ↔ GitHub **only if** you want:

- Edge Functions (e.g. `empty-documents-bucket`) versioned in `supabase/functions/` and deployed from the repo
- Supabase Branching (preview DB per PR — paid feature)

**Avoid** a second migration path (`supabase/migrations/`) alongside `backend/alembic/` — two schema owners cause drift.

### Checklist — all connected

1. **Railway** → Settings → Source: GitHub `TeamBrain`, root `backend`, Production `main`
2. **Vercel** → Project → Git: same repo, root `frontend`, Production `main`
3. **Railway** env: `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL`, `CORS_ORIGINS`, `PILOT_INVITE_CODE`
4. **Vercel** env: `NEXT_PUBLIC_API_URL` = `https://…railway.app` (with `https://`)
5. **Supabase** → Database → connection string in Railway only (no app deploy from Supabase)

## Database migrations

```bash
cd backend
alembic upgrade head
```

Optional local demo data: `SEED_DEMO_PASSWORD=... python scripts/seed_timtimol.py` (never commit password).

**Production fresh start:** wipe Supabase data and replay invite flow — see [fresh-start.md](fresh-start.md).

## Local development

Ports **3010** (UI) and **8010** (API). See [local-dev.md](local-dev.md).

Production security checklist: [security.md](security.md).

Pilot gate is **off** in `ENVIRONMENT=development` — any email works with invite code for testing.
