"""Seed Timtimol AIS demo data."""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text

from app.auth.passwords import hash_password
from app.db.session import SessionLocal

ORG_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USERS = [
    ("Amadou Diallo", "amadou@timtimol.sn", "owner", "11111111-1111-1111-1111-111111111101"),
    ("Fatou Sène", "fatou@timtimol.sn", "admin", "11111111-1111-1111-1111-111111111102"),
    ("Moussa Ba", "moussa@timtimol.sn", "manager", "11111111-1111-1111-1111-111111111103"),
    ("Aïssatou Ndiaye", "aissatou@timtimol.sn", "member", "11111111-1111-1111-1111-111111111104"),
    ("Ibrahima Fall", "ibrahima@timtimol.sn", "field_agent", "11111111-1111-1111-1111-111111111105"),
    ("Mariama Sow", "mariama@timtimol.sn", "field_agent", "11111111-1111-1111-1111-111111111106"),
    ("Ousmane Gueye", "ousmane@timtimol.sn", "member", "11111111-1111-1111-1111-111111111107"),
    ("Khady Mbaye", "khady@timtimol.sn", "member", "11111111-1111-1111-1111-111111111108"),
]

PROJECTS = [
    ("Évaluation filière riz Matam", "MASAE", "11111111-1111-1111-1111-222222222201"),
    ("Appui DAPSA Tambacounda", "DAPSA", "11111111-1111-1111-1111-222222222202"),
    ("Étude irrigation Kédougou", "SAED", "11111111-1111-1111-1111-222222222203"),
    ("Formation agents Ziguinchor", "FONGIP", "11111111-1111-1111-1111-222222222204"),
    ("Audit semences Saint-Louis", "COSDEP", "11111111-1111-1111-1111-222222222205"),
    ("Cartographie parcelles Thiès", "ANCAR", "11111111-1111-1111-1111-222222222206"),
]


async def seed() -> None:
    async with SessionLocal() as session:
        oid = str(ORG_ID)
        await session.execute(
            text(
                "DELETE FROM meeting_commitments WHERE meeting_id IN"
                " (SELECT id FROM meetings WHERE organization_id = CAST(:oid AS uuid))"
            ).bindparams(oid=oid),
        )
        await session.execute(
            text(
                "DELETE FROM meeting_action_items WHERE meeting_id IN"
                " (SELECT id FROM meetings WHERE organization_id = CAST(:oid AS uuid))"
            ).bindparams(oid=oid),
        )
        await session.execute(
            text(
                "DELETE FROM meeting_decisions WHERE meeting_id IN"
                " (SELECT id FROM meetings WHERE organization_id = CAST(:oid AS uuid))"
            ).bindparams(oid=oid),
        )
        await session.execute(
            text(
                "DELETE FROM event_attendees WHERE event_id IN"
                " (SELECT id FROM events WHERE organization_id = CAST(:oid AS uuid))"
            ).bindparams(oid=oid),
        )
        await session.execute(
            text(
                "DELETE FROM messages WHERE channel_id IN"
                " (SELECT id FROM channels WHERE organization_id = CAST(:oid AS uuid))"
            ).bindparams(oid=oid),
        )
        for table in (
            "agent_runs",
            "sync_queue",
            "memory_metadata",
            "daily_status",
            "field_reports",
            "meetings",
            "events",
            "documents",
            "tasks",
            "channels",
            "projects",
            "organization_invites",
            "org_memberships",
        ):
            await session.execute(
                text(f"DELETE FROM {table} WHERE organization_id = CAST(:oid AS uuid)").bindparams(oid=oid),
            )
        await session.execute(
            text(
                "DELETE FROM refresh_tokens WHERE user_id IN"
                " (SELECT id FROM users WHERE organization_id = CAST(:oid AS uuid))"
            ).bindparams(oid=oid),
        )
        await session.execute(
            text("DELETE FROM users WHERE organization_id = CAST(:oid AS uuid)").bindparams(oid=oid),
        )
        await session.execute(
            text("DELETE FROM organizations WHERE slug = 'timtimol' OR id = CAST(:oid AS uuid)").bindparams(oid=oid),
        )

        await session.execute(
            text(
                "INSERT INTO organizations (id, name, slug, plan, settings, language, owner_id,"
                " pricing_tier, trial_ends_at)"
                " VALUES (CAST(:oid AS uuid), 'Timtimol AIS', 'timtimol', 'starter',"
                " CAST(:settings AS jsonb), 'fr', CAST(:owner AS uuid), 'starter',"
                " now() + INTERVAL '365 days')"
            ).bindparams(
                oid=str(ORG_ID),
                settings=json.dumps({"org_type": "company", "team_size": "6-20"}),
                owner=USERS[0][3],
            ),
        )

        for name, email, role, uid in USERS:
            await session.execute(
                text(
                    "INSERT INTO users (id, organization_id, full_name, email, role, password_hash,"
                    " onboarding_completed) VALUES (CAST(:uid AS uuid), CAST(:oid AS uuid), :name,"
                    " :email, :role, :ph, true)"
                ).bindparams(
                    uid=uid,
                    oid=str(ORG_ID),
                    name=name,
                    email=email,
                    role=role,
                    ph=hash_password("Timtimol2026!"),
                ),
            )
            await session.execute(
                text(
                    "INSERT INTO org_memberships (user_id, organization_id, role)"
                    " VALUES (CAST(:uid AS uuid), CAST(:oid AS uuid), :role)"
                    " ON CONFLICT DO NOTHING"
                ).bindparams(uid=uid, oid=str(ORG_ID), role=role),
            )

        await session.execute(
            text(
                "INSERT INTO channels (id, organization_id, name, is_direct, created_by)"
                " VALUES (gen_random_uuid(), CAST(:oid AS uuid), 'general', false, CAST(:uid AS uuid))"
            ).bindparams(oid=str(ORG_ID), uid=USERS[0][3]),
        )

        for pname, client, pid in PROJECTS:
            await session.execute(
                text(
                    "INSERT INTO projects (id, organization_id, name, client_name, status, created_by)"
                    " VALUES (CAST(:pid AS uuid), CAST(:oid AS uuid), :name, :client, 'active',"
                    " CAST(:uid AS uuid))"
                ).bindparams(pid=pid, oid=str(ORG_ID), name=pname, client=client, uid=USERS[0][3]),
            )
            await session.execute(
                text(
                    "INSERT INTO channels (id, organization_id, name, project_id, created_by)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), :name, CAST(:pid AS uuid),"
                    " CAST(:uid AS uuid))"
                ).bindparams(oid=str(ORG_ID), name=pname, pid=pid, uid=USERS[0][3]),
            )

        tasks = [
            ("Collecter données parcelles Matam", PROJECTS[0][2], USERS[4][3], "in_progress", "high"),
            ("Rédiger TDR évaluation", PROJECTS[0][2], USERS[1][3], "todo", "medium"),
            ("Visite terrain Tambacounda", PROJECTS[1][2], USERS[5][3], "done", "urgent"),
            ("Préparer présentation DAPSA", PROJECTS[1][2], USERS[2][3], "review", "high"),
            ("Cartographier zones Kédougou", PROJECTS[2][2], USERS[4][3], "in_progress", "medium"),
        ]
        for title, pid, assignee, status, priority in tasks:
            await session.execute(
                text(
                    "INSERT INTO tasks (id, organization_id, project_id, title, assignee_id, status,"
                    " priority, due_date, created_by) VALUES (gen_random_uuid(), CAST(:oid AS uuid),"
                    " CAST(:pid AS uuid), :title, CAST(:aid AS uuid), :status, :priority,"
                    " CURRENT_DATE + 7, CAST(:uid AS uuid))"
                ).bindparams(
                    oid=str(ORG_ID),
                    pid=pid,
                    title=title,
                    aid=assignee,
                    status=status,
                    priority=priority,
                    uid=USERS[0][3],
                ),
            )

        docs = [
            ("TDR Évaluation Matam 2026", PROJECTS[0][2]),
            ("Rapport mission Tambacounda", PROJECTS[1][2]),
            ("Note méthodologique irrigation", PROJECTS[2][2]),
        ]
        for title, pid in docs:
            await session.execute(
                text(
                    "INSERT INTO documents (id, organization_id, project_id, title, file_url, uploaded_by)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:pid AS uuid), :title,"
                    " :url, CAST(:uid AS uuid))"
                ).bindparams(
                    oid=str(ORG_ID),
                    pid=pid,
                    title=title,
                    url=f"s3://timtimol/{title.replace(' ', '_')}.pdf",
                    uid=USERS[0][3],
                ),
            )

        for i, (name, _, _, uid) in enumerate(USERS[4:6]):
            await session.execute(
                text(
                    "INSERT INTO field_reports (id, organization_id, project_id, submitted_by,"
                    " mission_date, location_name, latitude, longitude, description, ai_summary)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:pid AS uuid),"
                    " CAST(:uid AS uuid), CURRENT_DATE - :days, :loc, :lat, :lng, :desc, :summary)"
                ).bindparams(
                    oid=str(ORG_ID),
                    pid=PROJECTS[i][2],
                    uid=uid,
                    days=i * 3,
                    loc=["Matam", "Tambacounda"][i % 2],
                    lat=15.6559 + i * 0.1,
                    lng=-13.2554 - i * 0.1,
                    desc=f"Mission terrain {name}",
                    summary="Observations favorables, recommandations formulées.",
                ),
            )

        now = datetime.now(timezone.utc)
        await session.execute(
            text(
                "INSERT INTO meetings (id, organization_id, project_id, title, date, ai_summary,"
                " transcript_text, processing_status, created_by)"
                " VALUES (CAST(:mid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid),"
                " 'Réunion lancement Matam', :date, :summary, :transcript, 'completed',"
                " CAST(:uid AS uuid))"
            ).bindparams(
                mid="11111111-1111-1111-1111-333333333301",
                oid=str(ORG_ID),
                pid=PROJECTS[0][2],
                date=now - timedelta(days=5),
                summary="Lancement du projet Matam. Décisions sur le calendrier et les livrables.",
                transcript="Amadou: Nous devons finaliser le TDR avant vendredi. Fatou s'en charge.",
                uid=USERS[0][3],
            ),
        )

        for uid in [u[3] for u in USERS[:4]]:
            await session.execute(
                text(
                    "INSERT INTO daily_status (id, organization_id, user_id, date, status_text, source)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:uid AS uuid), CURRENT_DATE,"
                    " 'Travail en cours sur les livrables', 'app')"
                ).bindparams(oid=str(ORG_ID), uid=uid),
            )

        await session.commit()
        print("Timtimol seed complete. Login: amadou@timtimol.sn / Timtimol2026!")


if __name__ == "__main__":
    asyncio.run(seed())
