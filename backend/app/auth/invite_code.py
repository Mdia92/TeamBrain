"""Pilot signup gate — invite code + optional email domain allowlist."""

from __future__ import annotations

from app.config import settings


def _expected_code() -> str:
    code = (settings.pilot_invite_code or "").strip()
    if code:
        return code
    if settings.environment == "development":
        return "2026timtimol"
    return ""


def check_invite_code(code: str | None) -> tuple[bool, str]:
    if not code:
        return False, "Code d'invitation invalide"
    if code.strip().upper() == _expected_code().upper():
        return True, "Code d'invitation valide"
    return False, "Code d'invitation invalide"


def pilot_email_domains() -> list[str]:
    raw = settings.pilot_email_domains or ""
    return [d.strip().lower() for d in raw.split(",") if d.strip()]


def check_pilot_email(email: str) -> tuple[bool, str]:
    """When pilot mode is on, restrict new accounts to allowed email domains."""
    if not settings.pilot_mode_enabled:
        return True, ""
    domains = pilot_email_domains()
    if not domains:
        return True, ""
    domain = email.strip().lower().split("@")[-1]
    if domain in domains:
        return True, ""
    allowed = ", ".join(f"@{d}" for d in domains)
    return (
        False,
        f"Inscription réservée au pilote Timtimol — utilisez une adresse {allowed}.",
    )


def pilot_blocks_extra_orgs() -> bool:
    return settings.pilot_mode_enabled
