# TeamBrain Frontend

Next.js 14 PWA for TeamBrain — French-default UI, offline field reports, Kanban with AI provenance badges.

**Local URL:** http://localhost:3010 (port 3010 avoids conflict with other apps on 3000)

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8010` in `.env.local` (TeamBrain API port).

See [docs/local-dev.md](../docs/local-dev.md) for full monorepo setup, Supabase, and demo credentials.
