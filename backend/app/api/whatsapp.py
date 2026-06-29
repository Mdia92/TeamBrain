"""WhatsApp gateway — Twilio webhook with signature validation and brain filtering."""

from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import text
from twilio.request_validator import RequestValidator

from app.agents import core
from app.agents.memory_service import MemoryService
from app.config import settings
from app.db.session import SessionLocal
from app.delivery.whatsapp import whatsapp_client
from app.mcp.twilio_server import process_group_audio_message
from app.workers.whatsapp_classifier import classify_whatsapp_message, should_persist_to_memory

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


def _hash_phone(phone: str) -> str:
    return hashlib.sha256(phone.encode()).hexdigest()


def _validate_twilio(request: Request, params: dict[str, str]) -> None:
    if not settings.twilio_auth_token:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Webhook WhatsApp non configuré",
        )
    signature = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    validator = RequestValidator(settings.twilio_auth_token)
    if not validator.validate(url, params, signature):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Signature Twilio invalide")


async def _insert_field_report_document(session, *, oid: str, uid: str, body: str) -> None:
    did = str(uuid.uuid4())
    await session.execute(
        text(
            "INSERT INTO documents (id, organization_id, title, file_url, content_type, file_size,"
            " ocr_text, doc_type, mission_date, submitted_by, synced_at)"
            " VALUES (CAST(:did AS uuid), CAST(:oid AS uuid), :title, :url, 'text/plain', 0,"
            " :desc, 'field_report', CURRENT_DATE, CAST(:uid AS uuid), now())"
        ).bindparams(
            did=did,
            oid=oid,
            title="Rapport WhatsApp",
            url=f"inline://whatsapp/{did}",
            desc=body,
            uid=uid,
        ),
    )


@router.get("/status")
async def whatsapp_status() -> dict:
    return {
        "twilio_configured": bool(settings.twilio_account_sid and settings.twilio_auth_token),
        "whatsapp_number": settings.twilio_whatsapp_number or None,
        "brain_filter": True,
        "group_meeting_capture": True,
    }


@router.post("/webhook")
async def twilio_webhook(request: Request) -> dict:
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}
    _validate_twilio(request, params)

    from_addr = params.get("From", "")
    body = params.get("Body", "")
    phone_hash = _hash_phone(from_addr.replace("whatsapp:", ""))

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
                from_addr.replace("whatsapp:", ""),
                "Numéro non enregistré. Contactez votre administrateur.",
            )
            return {"status": "unknown_user"}

        oid = str(user_row["organization_id"])
        uid = str(user_row["id"])

        meeting_result = await process_group_audio_message(
            session,
            org_id=oid,
            params=params,
            source_user_id=uid,
        )
        if meeting_result.get("status") == "processed":
            await session.commit()
            summary = meeting_result.get("summary") or "Réunion capturée"
            reply = (
                f"Réunion WhatsApp enregistrée. {summary[:120]}"
                " — consultez le tableau de bord pour approuver les tâches."
            )
            whatsapp_client.send_message(from_addr.replace("whatsapp:", ""), reply)
            return {"status": "meeting_captured", **meeting_result}

        category, confidence = await classify_whatsapp_message(body)
        if category == "irrelevant":
            await session.commit()
            whatsapp_client.send_message(from_addr.replace("whatsapp:", ""), "👍")
            return {"status": "ignored", "category": category}

        if category == "status_update":
            await session.execute(
                text(
                    "INSERT INTO daily_status (id, organization_id, user_id, date, status_text, source)"
                    " VALUES (gen_random_uuid(), CAST(:oid AS uuid), CAST(:uid AS uuid),"
                    " CURRENT_DATE, :text, 'whatsapp')"
                ).bindparams(oid=oid, uid=uid, text=body),
            )
            reply = "Statut enregistré. Merci!"

        elif category == "field_report":
            await _insert_field_report_document(session, oid=oid, uid=uid, body=body)
            reply = "Rapport terrain enregistré."

        elif category == "task_update" and "termin" in body.lower():
            await session.execute(
                text(
                    "UPDATE tasks SET status = 'done' WHERE organization_id = CAST(:oid AS uuid)"
                    " AND assignee_id = CAST(:uid AS uuid) AND status != 'done'"
                    " AND title ILIKE :q"
                ).bindparams(oid=oid, uid=uid, q=f"%{body[:30]}%"),
            )
            reply = "Tâche mise à jour."

        elif category == "question":
            result = await core.ask(session, oid, body, user_id=uid)
            reply = result.answer

        elif category in ("meeting_note", "commitment"):
            reply = "Engagement enregistré dans la mémoire d'équipe."

        else:
            reply = "Message reçu et enregistré."

        if should_persist_to_memory(category):
            brain = MemoryService(session)
            await brain.write_memory(
                org_id=oid,
                type="commitment" if category in ("meeting_note", "commitment") else "episodic",
                entity_type="whatsapp_message",
                entity_id=None,
                note=f"[WhatsApp] {body[:500]}",
                source_module="whatsapp",
                source_id=uid,
            )

        await session.commit()

    whatsapp_client.send_message(from_addr.replace("whatsapp:", ""), reply)
    return {"status": "processed", "category": category, "confidence": confidence}
