# TeamBrain — Production Security Checklist

Applied in code (June 2026). Railway/Vercel still require correct env vars.

## Backend

| Control | Implementation |
|---------|----------------|
| JWT secret | Startup fails in production if weak/missing (`startup.validate_production_settings`) |
| Pilot code | Required in production env; sent in **POST body**, not URL query |
| Rate limits | Login, signup, refresh, validate-invite-code (`slowapi`) |
| CORS | Localhost regex **only** in `ENVIRONMENT=development` |
| Webhooks | PayDunya unsigned rejected in production; Twilio fails closed if unconfigured |
| OAuth | Google `state` cookie + `email_verified` check |
| RLS signup | `bootstrap_signup_rls` before org/user inserts |
| Message SSE | Channel must belong to user's org |
| Uploads | 50 MB max (`app/upload_limits.py`), basename on filenames |
| Headers | HSTS, CSP, `frame-ancestors`, Permissions-Policy in production |
| Errors | Generic JSON 500 — no stack traces to clients |
| Health | Production returns `db: ok/failed` only (no schema version) |

## Frontend (Vercel)

| Control | Implementation |
|---------|----------------|
| Security headers | `next.config.mjs` — CSP, X-Frame-Options, etc. |
| API URL | `NEXT_PUBLIC_API_URL` with `https://` |
| Tokens | Access token in memory; refresh httpOnly cookie |
| Service worker | Does not cache `/_next/` bundles; network-first navigations |

## Railway env (required)

- `JWT_SECRET_KEY` — ≥32 chars (`python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- `PILOT_INVITE_CODE` — set explicitly (not empty)
- `DATABASE_URL` — single line, no trailing newline
- `ENVIRONMENT=production`
- `CORS_ORIGINS` + `FRONTEND_URL` → your Vercel URL

## Still recommended (ops)

- Run `alembic upgrade head` on deploy (`railway.toml` release command)
- Use Supabase **session pooler** URL with `postgresql+asyncpg://`
- Rotate `PILOT_INVITE_CODE` after pilot ends
- Add `pip audit` to CI when convenient
- Presigned download endpoint for documents (future hardening)

## Future feature (from product backlog)

See `docs/module-coordination-plan.md` — `module_findings` table and assistant synthesis (not security).
