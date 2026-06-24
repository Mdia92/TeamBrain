"""Automation model and engine tests."""

from app.automation.models import (
    ACTION_LABELS_FR,
    TRIGGER_LABELS_FR,
    matches_trigger_config,
    render_template,
    validate_action_type,
    validate_trigger_type,
)


def test_validate_trigger_types():
    assert validate_trigger_type("task_created") == "task_created"
    assert validate_trigger_type("meeting_processed") == "meeting_processed"


def test_validate_action_types():
    assert validate_action_type("notify_admin") == "notify_admin"


def test_trigger_config_filter():
    assert matches_trigger_config({}, {"task_id": "1"})
    assert matches_trigger_config({"priority": "high"}, {"priority": "high", "task_id": "1"})
    assert not matches_trigger_config({"priority": "high"}, {"priority": "low"})


def test_render_template():
    assert render_template("Bonjour {{title}}", {"title": "Test"}) == "Bonjour Test"


def test_french_labels_complete():
    assert TRIGGER_LABELS_FR["task_overdue"]
    assert ACTION_LABELS_FR["send_notification"]
