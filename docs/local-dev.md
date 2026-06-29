# TeamBrain — Local Development

TeamBrain uses **non-default ports** so it can run alongside other projects on `localhost:3000` / `8000`.

| Service  | URL | Default port |
|----------|-----|--------------|
| Frontend | http://localhost:3010 | 3010 |
| Backend API | http://localhost:8010 | 8010 |
| API docs (Swagger) | http://localhost:8010/docs | — |
| Health check | http://localhost:8010/health | — |

**Marketing home:** http://localhost:3010/ always shows the landing page (presentation). Login is at `/login`; signup and org wizard at `/create` (pilot invite code required). Logout returns to `/`.

**Pilot signup:** code `TIMTIMOL2026` — validated via `POST /api/auth/validate-invite-code?code=...`; required on `POST /api/auth/signup?code=...`.

**Assistant:** UI label follows org language — **Ask AI** (English), **Xam** (French/Wolof). Tune LLM name via `ASSISTANT_NAME` / `ASSISTANT_PERSONALITY` in `backend/.env`.

**Per-org rules:** defaults in `backend/app/policy/default_policy.yaml`; overrides in `organizations.settings.policy`. Admins edit via **Paramètres → Règles** or `GET/PATCH /api/organizations/current/policy`.

**Task dependencies:** migration `012_task_dependencies`; timeline at `/[orgSlug]/projects/[projectId]?tab=timeline`; APIs `POST/DELETE /api/tasks/{id}/dependencies`, `GET /api/projects/{id}/timeline`, `PATCH /api/tasks/{id}/dates`.

**Automations:** migration `013_automation_rules`; CRUD `/api/automations` (admin); **Paramètres → Automatisations** builder. Event worker + APIs fire rules on task/document/meeting events.

## One-time setup (you)

These steps require your credentials and cannot be automated in CI:

1. **Supabase** — create project, enable `pgvector`, set DB password
2. **`backend/.env`** — copy from `backend/.env.example`, fill:
   - `DATABASE_URL` — use **Session pooler** (IPv4) if direct `db.*.supabase.co` fails on your network  
     Example: `postgresql+asyncpg://postgres.<project-ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`
   - `JWT_SECRET_KEY` — `python -c "import secrets; print(secrets.token_urlsafe(32))"`
   - **LLM keys** (paste in `backend/.env`, lines `GEMINI_API_KEY` and `GROQ_API_KEY`):
     ```env
     GEMINI_API_KEY=your_gemini_key_here
     GROQ_API_KEY=your_groq_key_here
     ```
     Get Gemini: [Google AI Studio](https://aistudio.google.com/apikey) · Groq: [console.groq.com](https://console.groq.com)  
     Voice transcription tries **Gemini audio** first, then Groq `whisper-large-v3`, then OpenAI/Deepgram if configured.
   - Optional: `MISTRAL_API_KEY`, Twilio, S3, Google OAuth
3. **`frontend/.env.local`** — `NEXT_PUBLIC_API_URL=http://localhost:8010`
4. Optional: **`PAYDUNYA_API_KEY`**, `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_TOKEN` in `backend/.env` for checkout
5. **Migrations & seed** (once per database):
   ```bash
   cd backend
   .venv\Scripts\Activate.ps1   # Windows
   alembic upgrade head
   python scripts/seed_timtimol.py
   ```

## Run locally

**Terminal 1 — backend**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

**Terminal 2 — frontend**

```powershell
cd frontend
npm install   # first time only
npm run dev   # serves on http://localhost:3010
```

## Demo login (after seed)

Set in `backend/.env` before running `python scripts/seed_timtimol.py`:

```env
SEED_DEMO_EMAIL=amadou@timtimol.sn
SEED_DEMO_PASSWORD=your_local_demo_password
```

Use those credentials to sign in locally. **Never commit passwords** — GitGuardian and git history may retain leaked secrets; rotate any password that was ever pushed.

## Mobile (Capacitor)

Native iOS/Android shells wrap the static Next.js export (`out/`).

```powershell
cd frontend
npm run build          # web / Vercel (standalone)
npm run build:mobile   # static export → out/
npx cap sync           # or: npm run cap:sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode (macOS only)
```

**Live reload on a physical device:** set `CAPACITOR_DEV_SERVER_URL=http://<your-lan-ip>:3010` in `frontend/.env.local`, run `npm run dev`, then `npx cap sync`.

**Push notifications:** create a Firebase project, add iOS/Android apps, paste the service account JSON (single line) into `backend/.env` as `FIREBASE_SERVICE_ACCOUNT_JSON`, run `alembic upgrade head` (migration `007_device_tokens`).

## Verification (after changes)

With backend on **8010**:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q
ruff check app tests scripts
python scripts/e2e_api_sweep.py   # signup → onboarding → invite → project/tasks → assistant → memory
alembic upgrade head              # includes 008_merge_field_reports
```

```powershell
cd frontend
npm run build
```

## Port conflicts

If `3010` or `8010` are taken, pick free ports and update:

- `backend/.env` → `CORS_ORIGINS`, `FRONTEND_URL`
- `frontend/.env.local` → `NEXT_PUBLIC_API_URL`
- Frontend dev command: `next dev -p <port>`

## CORS + cache reset (upload / network errors)

Document uploads call `POST /api/documents` cross-origin. The API allows **`http://localhost:3010`** and **`http://127.0.0.1:3010`** (both — mismatch causes CORS failures).

**One-shot local reset:**

```powershell
# Windows (recommended)
.\scripts\dev-clean.ps1
```

```bash
# Git Bash / WSL / macOS
bash scripts/dev-clean.sh
```

Then in the browser on http://localhost:3010 — DevTools → Console — paste the contents of **`scripts/dev-browser-clean.js`** (unregisters stale service workers and clears caches).

Ensure `backend/.env` includes:

```env
CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010
```

Service workers are **disabled in `npm run dev`**; they only register in production builds.

## What only you can do

| Task | Why |
|------|-----|
| Create/manage Supabase project & password | Your cloud account |
| Add API keys in **`backend/.env`** (`GEMINI_API_KEY`, `GROQ_API_KEY`) | Your vendor accounts — file is gitignored |
| Create GitHub repo / Railway / Vercel deploy | Your hosting accounts |
| Rotate leaked secrets | Security — never commit `.env` |
| Enable IPv6 or use pooler URL | Network-specific DB connectivity |

## Documentation rule

After each implementation task, update: `README.md`, relevant `docs/*.md`, `.env.example` files, and `.cursor/rules/project.mdc` when behavior or ports change.
