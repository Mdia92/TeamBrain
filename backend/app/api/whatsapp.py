"""WhatsApp gateway — Twilio webhook."""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, Form, Request
from sqlalchemy import text

from app.agents import core
from app.agents.memory_service import MemoryService
from app.db.session import SessionLocal
from app.delivery.whatsapp import whatsapp_client
from app.workers.whatsapp_classifier import classify_whatsapp_message

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


def _hash_phone(phone: str) -> str:
    return hashlib.sha256(phone.encode()).hexdigest()


@router.post("/webhook")
async def twilio_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(...),
) -> dict:
    phone_hash = _hash_phone(From.replace("whatsapp:", ""))

    async with SessionLocal() as session:
        user_row = (
            (
                await session.execute(
                    text(
                        "SELECT id, organization_id FROM users WHERE phone_hash = :ph AND is_active = true"
                    ).bindparams(ph=phone_hash),
                )
            )
            .mappings()
            .first()
        )

        if not user_row:
            whatsapp_client.send_message(
                From.replace("whatsapp:", ""),
                "Numéro non enregistré. Contactez votre administrateur.",
            )
            return {"status": "unknown_user"}

        category, confidence = await classify_whatsapp_message(Body)
        oid = str(user_row["organization_id"])
        uid = str(user_row["id"])

        if category == "status_update":
            await session.execute(
                text(
                    "INSERT INTO daily_status (id, organization_id, user_id, date, status_text, source)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:uid AS uuid),"
                    " CURRENT_DATE, :text, 'whatsapp')"
                ).bindparams(oid=oid, uid=uid, text=Body),
            )
            reply = "Statut enregistré. Merci!"

        elif category == "field_report":
            await session.execute(
                text(
                    "INSERT INTO field_reports (id, organization_id, submitted_by, mission_date,"
                    " description, synced_at) VALUES (gen_random_uuid(), CAST(:oid AS uuid),"
                    " CAST(:uid AS uuid), CURRENT_DATE, :desc, now())"
                ).bindparams(oid=oid, uid=uid, desc=Body),
            )
            reply = "Rapport terrain enregistré."

        elif category == "task_update" and "termin" in Body.lower():
            await session.execute(
                text(
                    "UPDATE tasks SET status = 'done' WHERE organization_id = CAST(:oid AS uuid)"
                    " AND assignee_id = CAST(:uid AS uuid) AND status != 'done'"
                    " AND title ILIKE :q"
                ).bindparams(oid=oid, uid=uid, q=f"%{Body[:30]}%"),
            )
            reply = "Tâche mise à jour."

        elif category == "question":
            result = await core.ask(session, oid, Body, user_id=uid)
            reply = result.answer

        elif category in ("meeting_note", "commitment"):
            brain = MemoryService(session)
            await brain.write_memory(
                org_id=oid,
                type="commitment",
                entity_type="message",
                entity_id=None,
                note=Body,
                source_module="whatsapp",
                source_id=uid,
            )
            reply = "Engagement enregistré dans la mémoire d'équipe."

        else:
            reply = "Message reçu et enregistré."

        await session.commit()

    whatsapp_client.send_message(From.replace("whatsapp:", ""), reply)
    return {"status": "processed", "category": category, "confidence": confidence}
