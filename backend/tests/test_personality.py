"""Assistant personality (Xam) tests."""

from app.agents.personality import (
    assistant_display_name,
    assistant_system_prompt,
    uncertainty_prefix,
)


def test_assistant_name_defaults_to_xam():
    assert assistant_display_name() == "Xam"


def test_system_prompt_includes_xam_and_grounding():
    prompt = assistant_system_prompt()
    assert "Xam" in prompt
    assert "UNIQUEMENT" in prompt
    assert "invente jamais" in prompt


def test_uncertainty_prefix():
    assert "pas certain" in uncertainty_prefix().lower()
