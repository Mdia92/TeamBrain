# TeamBrain — Data Sovereignty

Supabase is treated as **vanilla managed PostgreSQL only**.

- No Supabase Auth, Storage client, Realtime, or Edge Functions
- Authentication: FastAPI JWT in `app/auth/`
- File storage: `StorageBackend` over S3-compatible endpoints
- RLS: `app.current_org_id` and `app.current_user_id` session variables via `coord_app` role
- Organizational memory: `memory_metadata` table with pgvector embeddings (Team Brain layer)
- Migration target: `pg_dump` → government PostgreSQL + MinIO with env-only changes

Phone numbers are SHA-256 hashed at rest; raw numbers are never logged.
