# Fresh start (production)

Use this when testing live on Vercel + Railway + Supabase and you want **zero organizations, zero users**, then walk through the real invite flow from scratch.

## 1. Wipe database data

**Warning:** destroys every org, user, project, task, and memory row. Cannot be undone.

1. Open [Supabase](https://supabase.com) → your project → **SQL Editor**.
2. Paste and run [`backend/scripts/wipe_all_tenant_data.sql`](../backend/scripts/wipe_all_tenant_data.sql).
3. Confirm:
   ```sql
   SELECT COUNT(*) FROM organizations;
   SELECT COUNT(*) FROM users;
   ```
   Both should return `0`.

**In-app alternative:** as owner/admin, remove members under **Paramètres → Équipe** (trash icon). This deletes their user row when they belong to no other organization. The org owner cannot be removed this way.

Optional: delete uploaded files in Supabase Storage (documents bucket) if you use S3/Storage — otherwise old files may remain orphaned.

## 2. Deploy latest code

Push to `main` so:

- **Railway** runs `alembic upgrade head` (includes `018_must_change_password`).
- **Vercel** rebuilds the frontend.

Check: `GET https://YOUR-RAILWAY-URL/api/health` — `db_migration` should be `018_must_change_password` or later.

## 3. Environment checklist

| Where | Variable | Purpose |
|-------|----------|---------|
| Railway | `PILOT_INVITE_CODE` | Secret code for **first** org creation at `/create` |
| Railway | `FRONTEND_URL` | Your Vercel URL (invite links) |
| Railway | `CORS_ORIGINS` | Same Vercel URL |
| Vercel | `NEXT_PUBLIC_API_URL` | `https://YOUR-RAILWAY-URL` |
| Railway | `SMTP_*` (optional) | Email invites to members; without SMTP, copy link from UI |

## 4. First user — create the organization

1. Open `https://YOUR-APP.vercel.app/create`
2. Enter **`PILOT_INVITE_CODE`** (from Railway — not shown in UI).
3. Complete the wizard: org name, **your** admin email, **your** password, modules, etc.
4. You land on the dashboard as **owner**.

You are the first user. No team invites exist yet.

## 5. Invite a member

1. Go to **Paramètres → Équipe** (or `/YOUR-SLUG/settings?tab=team`).
2. Enter the member’s email and role → **Inviter**.
3. If SMTP is configured, they receive email with:
   - Link: `/invite/{token}`
   - Code: `TB-XXXXXX` and page `/join`
4. If SMTP is **not** configured, copy the **link** and **code** from the yellow box in the UI and send manually (WhatsApp, etc.).

## 6. New member — first sign-in

1. Member opens the invite **link** or goes to `/join` and enters the **code**.
2. On the invite page they choose **Créer un compte**, enter name + email (must match invite).
3. They are **not** asked for a password — the invitation code is the temporary password.
4. They are redirected to **`/change-password`** and must set a personal password (8+ characters).
5. Then they reach the dashboard.

## 7. Member — return visits

1. Go to **`/login`**.
2. Sign in with **email + personal password** (not the TB code).
3. No password change prompt unless an admin resets the account.

## Auth pages (who uses what)

| Page | Who |
|------|-----|
| `/login` | Existing members (email + password) |
| `/join` | New members with invitation code |
| `/invite/{token}` | New members with email link |
| `/create` | Pilot only — first org / extra orgs when pilot allows |
| `/change-password` | Forced after first invite signup; optional anytime in Settings → Général |

## Troubleshooting

- **Invite code validation fails on live site** → fix `NEXT_PUBLIC_API_URL` on Vercel (must include `https://`).
- **Signup/login 500** → check Railway `DATABASE_URL` (no trailing newline).
- **Stale UI after deploy** → DevTools → Application → Service Workers → Unregister, hard refresh.
- **Member stuck on change-password** → they must enter the **TB code** as “current password”, then new password twice.

See also [deploy.md](deploy.md) and [local-dev.md](local-dev.md).
