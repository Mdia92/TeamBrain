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


async def send_email(*, to: str, subject: str, body: str) -> bool:
    """Send a transactional email. Returns True if sent via SMTP, False if logged only."""
    to_addr = to.strip()
    if not to_addr:
        return False
    if settings.smtp_host:
        try:
            await asyncio.to_thread(
                _send_smtp_sync,
                to=to_addr,
                subject=subject,
                body=body,
            )
            logger.info("email_sent", to=to_addr, subject=subject)
            return True
        except Exception:
            logger.exception("email_send_failed", to=to_addr, subject=subject)
            return False
    logger.info("email_logged", to=to_addr, subject=subject, body=body)
    return False


async def notify_admin(*, event: str, subject: str, body: str) -> None:
    """Send activity notification to the platform admin email."""
    to = (settings.admin_notification_email or "").strip()
    if not to:
        logger.warning("admin_notification_skipped", event=event, reason="no_admin_email")
        return

    full_body = f"{body}\n\n—\nÉvénement : {event}\nTeamBrain"
    await send_email(to=to, subject=f"[TeamBrain] {subject}", body=full_body)
