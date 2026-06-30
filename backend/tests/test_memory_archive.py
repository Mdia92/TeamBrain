"""Tests for memory archive on delete."""

from app.services.memory_archive import _archive_header, _clip


def test_archive_header_contains_marker():
    h = _archive_header("projet", "Test Projet", "abc-123")
    assert "ARCHIVÉ" in h
    assert "Test Projet" in h
    assert "abc-123" in h


def test_clip_truncates_long_text():
    assert _clip("x" * 3000, 100).endswith("…")
    assert len(_clip("short")) == 5
