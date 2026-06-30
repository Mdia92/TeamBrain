"""Password change API tests."""

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


def _signup() -> tuple[str, str]:
    email = f"pw-{secrets.token_hex(4)}@example.sn"
    password = "InitialPass123!"
    r = client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": password,
            "password_confirm": password,
            "full_name": "PW User",
            "organization_name": "PW Org",
            "invite_code": VALID_CODE,
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"], password


def test_change_password_success():
    token, old_pw = _signup()
    me0 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    email = me0.json()["email"]
    new_pw = "NewSecure456!"
    r = client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": old_pw,
            "new_password": new_pw,
            "new_password_confirm": new_pw,
        },
    )
    assert r.status_code == 200
    assert r.json()["must_change_password"] is False

    bad = client.post("/api/auth/login", json={"email": email, "password": old_pw})
    assert bad.status_code == 401

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json().get("must_change_password") is False


def test_change_password_wrong_current():
    token, old_pw = _signup()
    r = client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "WrongPass999!",
            "new_password": "NewSecure456!",
            "new_password_confirm": "NewSecure456!",
        },
    )
    assert r.status_code == 400
    assert "actuel" in r.json()["detail"].lower()


def test_change_password_mismatch():
    token, old_pw = _signup()
    r = client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": old_pw,
            "new_password": "NewSecure456!",
            "new_password_confirm": "OtherSecure789!",
        },
    )
    assert r.status_code == 400
