"""Invite code + pilot email gate tests."""

import secrets

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)

VALID_CODE = "2026timtimol"


@pytest.fixture(autouse=True)
def _pilot_code(monkeypatch):
    monkeypatch.setattr(settings, "pilot_invite_code", VALID_CODE)


def test_validate_invite_code_valid():
    r = client.post("/api/auth/validate-invite-code", json={"code": VALID_CODE})
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert "valide" in data["message"].lower()


def test_validate_invite_code_case_insensitive():
    r = client.post("/api/auth/validate-invite-code", json={"code": "2026TIMTIMOL"})
    assert r.status_code == 200
    assert r.json()["valid"] is True


def test_validate_invite_code_invalid():
    r = client.post("/api/auth/validate-invite-code", json={"code": "WRONG"})
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is False
    assert data["message"] == "Code d'invitation invalide"


def test_signup_rejects_invalid_code():
    r = client.post(
        "/api/auth/signup",
        json={
            "email": f"bad-{secrets.token_hex(4)}@example.sn",
            "password": "TestPass123!",
            "full_name": "Test User",
            "organization_name": "Test Org",
            "invite_code": "WRONG",
        },
    )
    assert r.status_code == 403
    assert "invalide" in r.json()["detail"].lower()


def test_signup_requires_invite_code():
    r = client.post(
        "/api/auth/signup",
        json={
            "email": f"nocode-{secrets.token_hex(4)}@example.sn",
            "password": "TestPass123!",
            "full_name": "Test User",
            "organization_name": "Test Org",
        },
    )
    assert r.status_code == 422


def test_signup_with_valid_code():
    email = f"ok-{secrets.token_hex(4)}@example.sn"
    r = client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Pilot User",
            "organization_name": "Pilot Org",
            "invite_code": VALID_CODE,
        },
    )
    assert r.status_code == 200
    assert r.json()["user"]["email"] == email


def test_signup_rejects_non_pilot_email_when_domains_configured(monkeypatch):
    monkeypatch.setattr(settings, "pilot_mode", True)
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "pilot_email_domains", "timtimol.org")
    r = client.post(
        "/api/auth/signup",
        json={
            "email": f"blocked-{secrets.token_hex(4)}@gmail.com",
            "password": "TestPass123!",
            "full_name": "Outsider",
            "organization_name": "Bad Org",
            "invite_code": VALID_CODE,
        },
    )
    assert r.status_code == 403
    assert "timtimol" in r.json()["detail"].lower()


def test_signup_allows_any_email_when_no_domain_gate(monkeypatch):
    monkeypatch.setattr(settings, "pilot_mode", True)
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "pilot_email_domains", "")
    email = f"anyone-{secrets.token_hex(4)}@gmail.com"
    r = client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Pilot User",
            "organization_name": "Pilot Org",
            "invite_code": VALID_CODE,
        },
    )
    assert r.status_code == 200


def test_create_org_blocked_in_pilot_mode(monkeypatch):
    monkeypatch.setattr(settings, "pilot_mode", True)
    monkeypatch.setattr(settings, "environment", "production")
    email = f"multi-{secrets.token_hex(4)}@timtimol.sn"
    r = client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Multi Org",
            "organization_name": "First Org",
            "invite_code": VALID_CODE,
        },
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    r2 = client.post(
        "/api/auth/create-org",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_name": "Second Org",
            "industry": "ngo",
            "team_size": "1-10",
            "primary_language": "fr",
            "modules": ["projects"],
            "invites": [],
        },
    )
    assert r2.status_code == 403
