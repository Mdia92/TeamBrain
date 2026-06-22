# TeamBrain — Data Contracts

## Memory metadata (`memory_metadata`)

Written only via `MemoryService.write_memory()` — never direct inserts from API handlers.

| Field | Type | Notes |
|-------|------|-------|
| `organization_id` | UUID | RLS-scoped |
| `type` | string | `episodic` \| `semantic` \| `commitment` \| `decision` \| `relationship` |
| `entity_type` | string? | `task`, `meeting`, `field_report`, `message`, `document`, `commitment` |
| `entity_id` | UUID? | linked record |
| `note` | text | human-readable memory content |
| `source_module` | string? | e.g. `meetings`, `whatsapp`, `events` |
| `source_id` | string? | originating record id |
| `embedding` | vector(768)? | pgvector; Gemini embeddings with hash fallback |

## core.py API (Python)

```python
await core.ingest(session, org_id, payload)           # normalize → MemoryService
await core.search(session, org_id, query, limit=10)   # semantic hits
await core.get_accountability(session, org_id)          # rules-first commitments
await core.ask(session, org_id, question)               # unified assistant JSON
```

`ask()` response shape:

```json
{
  "answer": "string (French)",
  "confidence": 0.0,
  "sources": ["module:id — note"]
}
```

## Meeting extraction output

```json
{
  "summary": "string (3-5 sentences, French)",
  "decisions": ["string"],
  "action_items": [{"description": "string", "assignee_name": "string|null", "due_date": "YYYY-MM-DD|null"}],
  "commitments": [{"text": "string", "person_name": "string|null", "deadline": "YYYY-MM-DD|null"}],
  "open_questions": ["string"],
  "key_topics": ["string"]
}
```

## Field report schema

```json
{
  "mission_date": "date",
  "location_name": "string",
  "latitude": "float",
  "longitude": "float",
  "description": "string",
  "photos": ["url"],
  "structured_data": "object"
}
```

## Task provenance

| Field | Values |
|-------|--------|
| `source` | `manual` \| `meeting_ai` \| `whatsapp` \| `ai_suggestion` |
| `source_reference` | `meeting_id` or `message_id` |

Frontend Kanban renders badges for `meeting_ai` and `whatsapp` with deep links via `source_reference`.
