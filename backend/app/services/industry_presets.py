"""Industry-based module and terminology presets for onboarding."""

from __future__ import annotations

ALL_MODULES = (
    "projects",
    "field-reports",
    "meetings",
    "documents",
    "calendar",
    "whatsapp",
    "messages",
)

DEFAULT_TERMINOLOGY = {
    "field_agent": "Agent terrain",
    "field_report": "Rapport terrain",
    "subject": "Bénéficiaire",
    "work_unit": "Projet",
}

INDUSTRY_PRESETS: dict[str, dict] = {
    "ngo": {
        "modules": ["projects", "field-reports", "meetings", "documents", "calendar", "whatsapp"],
        "terminology": {
            "field_agent": "Agent terrain",
            "field_report": "Rapport terrain",
            "subject": "Bénéficiaire",
            "work_unit": "Projet",
        },
    },
    "tech": {
        "modules": ["projects", "documents", "meetings", "calendar", "messages"],
        "terminology": {
            "field_agent": "Développeur",
            "field_report": "Sprint",
            "subject": "Release",
            "work_unit": "Sprint",
        },
    },
    "education": {
        "modules": ["projects", "documents", "calendar", "messages"],
        "terminology": {
            "field_agent": "Enseignant",
            "field_report": "Cours",
            "subject": "Élève",
            "work_unit": "Cours",
        },
    },
    "health": {
        "modules": ["projects", "documents", "meetings", "calendar"],
        "terminology": {
            "field_agent": "Praticien",
            "field_report": "Consultation",
            "subject": "Patient",
            "work_unit": "Consultation",
        },
    },
    "commerce": {
        "modules": ["projects", "documents", "calendar", "whatsapp"],
        "terminology": {
            "field_agent": "Vendeur",
            "field_report": "Commande",
            "subject": "Client",
            "work_unit": "Commande",
        },
    },
    "agriculture": {
        "modules": ["projects", "field-reports", "documents", "calendar", "whatsapp"],
        "terminology": {
            "field_agent": "Technicien",
            "field_report": "Parcelle",
            "subject": "Récolte",
            "work_unit": "Parcelle",
        },
    },
    "other": {
        "modules": list(ALL_MODULES),
        "terminology": dict(DEFAULT_TERMINOLOGY),
    },
}


def preset_for_industry(industry: str) -> dict:
    return INDUSTRY_PRESETS.get(industry, INDUSTRY_PRESETS["other"])


def build_org_settings(
    *,
    industry: str,
    team_size: str,
    primary_language: str,
    modules: list[str] | None = None,
    setup_checklist: dict | None = None,
) -> dict:
    preset = preset_for_industry(industry)
    allowed = set(ALL_MODULES)
    if modules:
        selected = [m for m in modules if m in allowed]
    else:
        selected = [m for m in preset["modules"] if m in allowed]
    if not selected:
        selected = list(ALL_MODULES)
    return {
        "industry": industry,
        "team_size": team_size,
        "primary_language": primary_language,
        "modules": selected,
        "terminology": preset["terminology"],
        "setup_checklist": setup_checklist
        or {
            "profile_completed": False,
            "team_invited": False,
            "first_project": False,
            "first_field_report": False,
            "first_meeting": False,
        },
    }
