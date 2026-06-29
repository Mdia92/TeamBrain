"""Admin notification email — optional SMTP; always logs when SMTP is not configured."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def _send_smtp_sync(*, to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user or to
    msg["To"] = to
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


async def notify_admin(*, event: str, subject: str, body: str) -> None:
    """Send activity notification to the platform admin email."""
    to = (settings.admin_notification_email or "").strip()
    if not to:
        logger.warning("admin_notification_skipped", event=event, reason="no_admin_email")
        return

    full_body = f"{body}\n\n—\nÉvénement : {event}\nTeamBrain"
    if settings.smtp_host:
        try:
            await asyncio.to_thread(
                _send_smtp_sync,
                to=to,
                subject=f"[TeamBrain] {subject}",
                body=full_body,
            )
            logger.info("admin_notification_sent", event=event, to=to)
        except Exception:
            logger.exception("admin_notification_failed", event=event, to=to)
    else:
        logger.info("admin_notification", event=event, to=to, subject=subject, body=full_body)
