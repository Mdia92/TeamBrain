"""Documents Agent — rule extraction and task suggestion."""

from app.agents.documents_agent import (
    decide_tasks,
    reason_document,
    verify_suggestion,
)


def test_invoice_due_june_30_extracts_task_with_confidence():
    text = "Invoice #1234\nAmount: 50000 FCFA\nInvoice due June 30"
    signals = reason_document(text, [])
    suggestions = decide_tasks(signals, text)

    assert suggestions, "expected at least one task suggestion"
    top = suggestions[0]
    assert top.confidence >= 0.75
    assert top.due_date is not None
    assert "facture" in top.title.lower() or "payer" in top.title.lower()
    assert verify_suggestion(top, text)


def test_report_deadline_flags_review_when_date_missing():
    text = "Please deliver the field report before the committee meets."
    signals = reason_document(text, [])
    suggestions = decide_tasks(signals, text)
    assert any(s.finding_type == "action_item" for s in suggestions)


def test_money_and_date_signals():
    text = "Paiement de 250 000 FCFA avant le 2026-06-30"
    signals = reason_document(text, [])
    types = {s.signal_type for s in signals}
    assert "date" in types
    assert "money" in types


def test_verify_rejects_ungrounded_suggestion():
    text = "Invoice due June 30"
    suggestions = decide_tasks(reason_document(text, []), text)
    sug = suggestions[0]
    sug.snippet = "unrelated context only"
    sug.keywords = ["xyzinvalid"]
    sug.due_date = "2099-01-01"
    assert not verify_suggestion(sug, text)
