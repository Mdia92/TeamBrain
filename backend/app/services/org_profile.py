"""Seed and reinforce foundational org knowledge in Team Brain memory."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_service import MemoryService

INDUSTRY_LABELS = {
    "ngo": "ONG",
    "tech": "Tech",
    "education": "Éducation",
    "health": "Santé",
    "agriculture": "Agriculture",
    "commerce": "Commerce",
    "other": "Autre",
}


def build_org_profile_note(*, name: str, settings: dict[str, Any]) -> str:
    industry = settings.get("industry", "other")
    industry_label = INDUSTRY_LABELS.get(industry, industry)
    team_size = settings.get("team_size", "1-10")
    lang = settings.get("primary_language", "fr")
    modules = ", ".join(settings.get("modules") or [])
    description = (settings.get("org_description") or "").strip()
    goals = (settings.get("org_goals") or "").strip()

    lines = [
        "Profil organisationnel (connaissance fondamentale — à préserver et renforcer) :",
        f"Organisation : {name}",
        f"Secteur : {industry_label}",
        f"Taille d'équipe : {team_size}",
        f"Langue principale : {lang}",
    ]
    if modules:
        lines.append(f"Modules actifs : {modules}")
    if description:
        lines.append(f"Mission / activité : {description}")
    if goals:
        lines.append(f"Objectifs : {goals}")
    lines.append(
        "Ce profil sert de contexte de base pour l'assistant et doit être enrichi "
        "par les informations des modules sans être contredit sans preuve."
    )
    return "\n".join(lines)


async def write_org_profile_memory(
    session: AsyncSession,
    *,
    org_id: str,
    name: str,
    settings: dict[str, Any],
) -> str:
    note = build_org_profile_note(name=name, settings=settings)
    svc = MemoryService(session)
    return await svc.write_memory(
        org_id=org_id,
        type="semantic",
        entity_type="document",
        entity_id=org_id,
        note=note,
        source_module="onboarding",
        source_id=org_id,
    )
