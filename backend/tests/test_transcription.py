"""Transcription helper tests."""

from app.services.document_extract import detect_format
from app.workers.transcription import _mime_type, is_audio_filename


def test_is_audio_filename_by_extension():
    assert is_audio_filename("note.m4a")
    assert is_audio_filename("clip.mp3")
    assert is_audio_filename("voice.ogg")
    assert is_audio_filename("rec.wav")
    assert not is_audio_filename("doc.pdf")


def test_is_audio_filename_by_content_type():
    assert is_audio_filename("blob", "audio/webm")


def test_detect_format_audio():
    assert detect_format("memo.mp3", "audio/mpeg") == "audio"


def test_mime_type_mapping():
    assert _mime_type("x.m4a", None) == "audio/mp4"
    assert _mime_type("x.wav", None) == "audio/wav"
