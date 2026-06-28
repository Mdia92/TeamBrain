"""Invite code gate for pilot signup."""

import secrets

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_CODE = "TIMTIMOL2026"


def test_validate_invite_code_valid():
    r = client.post(f"/api/auth/validate-invite-code?code={VALID_CODE}")
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert "valide" in data["message"].lower()


def test_validate_invite_code_invalid():
    r = client.post("/api/auth/validate-invite-code?code=WRONG")
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is False
    assert data["message"] == "Code d'invitation invalide"


def test_signup_rejects_invalid_code():
    r = client.post(
        "/api/auth/signup?code=WRONG",
        json={
            "email": f"bad-{secrets.token_hex(4)}@example.sn",
            "password": "TestPass123!",
            "full_name": "Test User",
            "organization_name": "Test Org",
        },
    )
    assert r.status_code == 403
    assert "invalide" in r.json()["detail"].lower()


def test_signup_requires_code_param():
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
        f"/api/auth/signup?code={VALID_CODE}",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Pilot User",
            "organization_name": "Pilot Org",
        },
    )
    assert r.status_code == 200
    assert r.json()["user"]["email"] == email


def test_create_org_after_signup():
    email = f"multi-{secrets.token_hex(4)}@example.sn"
    r = client.post(
        f"/api/auth/signup?code={VALID_CODE}",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Multi Org",
            "organization_name": "First Org",
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
    assert r2.status_code == 200
    assert r2.json()["user"]["org_slug"]
