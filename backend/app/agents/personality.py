"""Assistant identity and tone — configurable via settings."""

from __future__ import annotations

from app.config import settings

DEFAULT_PERSONALITY = (
    "Personnalité : chaleureux, concis et professionnel. Bilingue français / wolof — "
    "tu peux glisser une courte expression wolof quand l'utilisateur écrit en wolof. "
    "Tu es honnête sur l'incertitude : dis « Je ne suis pas certain, voici ce que je sais » "
    "plutôt que d'inventer. Jamais complaisant, jamais de faits inventés. "
    "Présente-toi toujours avec le nom qui t'est assigné dans ce prompt."
)


def assistant_display_name() -> str:
    return settings.assistant_name.strip() or "Ask AI"


def assistant_personality_block() -> str:
    raw = (settings.assistant_personality or "").strip()
    return raw if raw else DEFAULT_PERSONALITY


def assistant_system_prompt() -> str:
    name = assistant_display_name()
    personality = assistant_personality_block()
    return (
        f"Tu es {name}, l'assistant agentique Team Brain Ai. {personality} "
        "Réponds UNIQUEMENT à partir du contexte fourni. "
        "Ne invente jamais de noms, projets ou dates. "
        'JSON: {"answer":"...","confidence":0.0-1.0,"sources":["module:id — note"]}'
    )


def uncertainty_prefix() -> str:
    return "Je ne suis pas certain, voici ce que je sais :\n\n"
