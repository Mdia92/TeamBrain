"""Tests for module findings coordination layer."""

from app.services.module_findings import format_findings_for_context, synthesize_findings
from app.storage.urls import storage_key_from_url


def test_storage_key_from_s3_url():
    parsed = storage_key_from_url("s3://my-bucket/org/docs/file.pdf")
    assert parsed == ("my-bucket", "org/docs/file.pdf")


def test_storage_key_from_local_url():
    parsed = storage_key_from_url("local://org/documents/x/report.pdf")
    assert parsed == ("local", "org/documents/x/report.pdf")


def test_format_findings_for_context():
    findings = [
        {
            "module": "documents",
            "finding_type": "deadline",
            "content": "Rapport avant vendredi",
            "confidence": 0.9,
        },
        {
            "module": "tasks",
            "finding_type": "task_event",
            "content": "Tâche créée: Budget",
            "confidence": 1.0,
        },
    ]
    text = format_findings_for_context(findings)
    assert "documents" in text
    assert "deadline" in text
    assert "tasks" in text


def test_synthesize_findings_empty():
    out = synthesize_findings([])
    assert out["total"] == 0
    assert "Aucune activité" in out["narrative"]


def test_synthesize_findings_counts():
    findings = [
        {
            "module": "meetings",
            "finding_type": "decision",
            "content": "Valider le budget",
            "confidence": 0.95,
            "source_id": None,
        },
        {
            "module": "meetings",
            "finding_type": "action_item",
            "content": "Envoyer le rapport",
            "confidence": 0.7,
            "source_id": None,
        },
    ]
    out = synthesize_findings(findings)
    assert out["total"] == 2
    assert out["counts_by_module"]["meetings"]["decision"] == 1
    assert len(out["highlights"]) == 1
