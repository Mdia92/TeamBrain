"""Pilot invite code gate for public signup."""

PILOT_INVITE_CODE = "TIMTIMOL2026"


def check_invite_code(code: str | None) -> tuple[bool, str]:
    if code and code.strip() == PILOT_INVITE_CODE:
        return True, "Code d'invitation valide"
    return False, "Code d'invitation invalide"
