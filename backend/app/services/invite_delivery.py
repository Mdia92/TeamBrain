"""Send team invitation emails to invitees."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.delivery.email import send_email


def build_invite_email_body(
    *,
    org_name: str,
    inviter_name: str,
    role: str,
    invite_url: str,
    join_url: str,
    short_code: str,
) -> str:
  return f"""Bonjour,

{inviter_name} vous invite à rejoindre l'équipe « {org_name} » sur TeamBrain en tant que {role}.

Pour accepter l'invitation :

1. Ouvrez ce lien (valide 7 jours) :
   {invite_url}

2. Ou entrez ce code sur la page de rejoindre :
   {join_url}
   Code : {short_code}

3. Créez votre compte avec l'adresse email qui a reçu cette invitation, ou connectez-vous si vous avez déjà un compte.

Vous n'apparaîtrez dans l'équipe qu'après avoir accepté l'invitation.

— TeamBrain
"""


async def send_team_invite_email(
    *,
    to_email: str,
    org_name: str,
    inviter_name: str,
    role: str,
    short_code: str,
    invite_path: str,
) -> bool:
    front = settings.frontend_url.rstrip("/")
    invite_url = f"{front}{invite_path}"
    join_url = f"{front}/join"
    body = build_invite_email_body(
        org_name=org_name,
        inviter_name=inviter_name,
        role=role,
        invite_url=invite_url,
        join_url=join_url,
        short_code=short_code,
    )
    return await send_email(
        to=to_email,
        subject=f"Invitation TeamBrain — {org_name}",
        body=body,
    )


async def deliver_organization_invite(
    session: AsyncSession,
    *,
    org_id: str,
    invite: dict[str, str],
    email: str,
    role: str,
    inviter_id: str,
) -> dict[str, str | bool]:
    """Send invite email to invitee and notify admin."""
    from app.delivery.email import notify_admin

    org_row = (
        await session.execute(
            text("SELECT name FROM organizations WHERE id = CAST(:oid AS uuid)").bindparams(oid=org_id),
        )
    ).mappings().first()
    inviter_row = (
        await session.execute(
            text("SELECT full_name, email FROM users WHERE id = CAST(:uid AS uuid)").bindparams(uid=inviter_id),
        )
    ).mappings().first()
    org_name = org_row["name"] if org_row else "TeamBrain"
    inviter_name = (inviter_row["full_name"] if inviter_row else "Un administrateur") or "Un administrateur"

    front = settings.frontend_url.rstrip("/")
    invite_url = f"{front}{invite['invite_url']}"
    sent = await send_team_invite_email(
        to_email=email,
        org_name=org_name,
        inviter_name=inviter_name,
        role=role,
        short_code=invite["short_code"],
        invite_path=invite["invite_url"],
    )

    await notify_admin(
        event="team_invite",
        subject="Invitation équipe envoyée",
        body=(
            f"Organisation : {org_name}\n"
            f"Invité par : {inviter_name}\n"
            f"Email invité : {email}\n"
            f"Rôle : {role}\n"
            f"Code : {invite['short_code']}\n"
            f"Lien : {invite_url}\n"
            f"Email invité envoyé : {'oui' if sent else 'non (SMTP non configuré — voir logs)'}"
        ),
    )
    return {"email_sent": sent, "invite_url": invite_url, "short_code": invite["short_code"]}
