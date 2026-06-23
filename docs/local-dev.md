# TeamBrain — Local Development

TeamBrain uses **non-default ports** so it can run alongside other projects on `localhost:3000` / `8000`.

| Service  | URL | Default port |
|----------|-----|--------------|
| Frontend | http://localhost:3010 | 3010 |
| Backend API | http://localhost:8010 | 8010 |
| API docs (Swagger) | http://localhost:8010/docs | — |
| Health check | http://localhost:8010/health | — |

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
   - Optional: `MISTRAL_API_KEY`, Twilio, S3, Google OAuth
3. **`frontend/.env.local`** — `NEXT_PUBLIC_API_URL=http://localhost:8010`
4. **Migrations & seed** (once per database):
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

- Email: `amadou@timtimol.sn`
- Password: `Timtimol2026!`

## Verification (after changes)

With backend on **8010**:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q
ruff check app tests scripts
python scripts/e2e_api_sweep.py   # signup → onboarding → invite → project/tasks → assistant → memory
alembic upgrade head              # includes 006_junction_rls for project_members RLS
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
