"""Twilio WhatsApp delivery — no-op when unconfigured."""

from __future__ import annotations

from datetime import UTC, datetime

import structlog

from app.config import settings

log = structlog.get_logger("coord.delivery.whatsapp")


class WhatsAppClient:
    def __init__(self) -> None:
        self._sid = settings.twilio_account_sid
        self._token = settings.twilio_auth_token
        self._from = settings.twilio_whatsapp_number
        self.enabled = bool(self._sid and self._token and self._from)
        self._client = None
        if self.enabled:
            try:
                from twilio.rest import Client

                self._client = Client(self._sid, self._token)
            except Exception:
                self.enabled = False

    def send_message(self, to_number: str, body: str) -> dict[str, str]:
        if not self.enabled or not self._client:
            return {"sid": "", "status": "not_configured", "sent_at": datetime.now(UTC).isoformat()}
        try:
            msg = self._client.messages.create(
                from_=f"whatsapp:{self._from}",
                to=f"whatsapp:{to_number}",
                body=body[:1600],
            )
            return {"sid": msg.sid, "status": msg.status, "sent_at": datetime.now(UTC).isoformat()}
        except Exception:
            log.warning("whatsapp_send_failed", exc_info=True)
            return {"sid": "", "status": "failed", "sent_at": datetime.now(UTC).isoformat()}


whatsapp_client = WhatsAppClient()
