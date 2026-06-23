"""Quick API sweep for fdbck.txt journeys — run with backend on 8010."""

from __future__ import annotations

import secrets
import sys

import httpx

from app.config import settings

BASE = "http://127.0.0.1:8010"


def main() -> int:
    errors: list[str] = []
    c = httpx.Client(base_url=BASE, timeout=60.0)

    try:
        c.get("/health")
    except httpx.ConnectError:
        print("ERROR: backend not running on 8010")
        return 1

    email = f"test-{secrets.token_hex(4)}@example.sn"
    r = c.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Test Admin",
            "organization_name": "Org Test Flow",
            "industry": "ngo",
            "team_size": "1-10",
            "primary_language": "fr",
        },
    )
    if r.status_code != 200:
        errors.append(f"signup: {r.status_code} {r.text[:300]}")
        print("\n".join(errors))
        return 1

    data = r.json()
    token = data["access_token"]
    slug = data["user"]["org_slug"]
    h = {"Authorization": f"Bearer {token}"}

    r2 = c.post(
        "/api/auth/onboarding",
        headers=h,
        json={"modules": ["projects", "documents", "calendar"], "invites": []},
    )
    if r2.status_code != 200:
        errors.append(f"onboarding: {r2.status_code} {r2.text[:300]}")

    me = c.get("/api/auth/me", headers=h).json()
    mods = (me.get("settings") or {}).get("modules", [])
    if "projects" not in mods:
        errors.append(f"me settings missing modules: {me.get('settings')}")
    billing = me.get("billing") or {}
    if billing.get("pricing_tier") != "free_trial":
        errors.append(f"expected free_trial got {billing.get('pricing_tier')}")

    dash = c.get("/api/dashboard", headers=h)
    if dash.status_code != 200:
        errors.append(f"dashboard: {dash.status_code}")
    elif "setup_checklist" not in dash.json():
        errors.append("dashboard missing setup_checklist")

    inv_email = f"invite-{secrets.token_hex(3)}@example.sn"
    r5 = c.post("/api/invites", headers=h, json={"email": inv_email, "role": "manager"})
    if r5.status_code != 201:
        errors.append(f"invite create: {r5.status_code} {r5.text[:300]}")
    else:
        inv_token = r5.json()["token"]
        prev = c.get(f"/api/auth/invite/{inv_token}")
        if prev.status_code != 200:
            errors.append(f"invite preview: {prev.status_code}")

    rp = c.post("/api/projects", headers=h, json={"name": "Projet Flow Test"})
    if rp.status_code not in (200, 201):
        errors.append(f"project create: {rp.status_code} {rp.text[:300]}")
    else:
        pid = rp.json()["id"]
        for i in range(3):
            rt = c.post("/api/tasks", headers=h, json={"project_id": pid, "title": f"Task {i + 1}"})
            if rt.status_code not in (200, 201):
                errors.append(f"task create {i}: {rt.status_code} {rt.text[:200]}")

    for q in [
        "Qui doit encore livrer quelque chose?",
        "Où en est le projet Projet Flow Test?",
        "Quelles décisions ont été prises récemment?",
    ]:
        try:
            ra = c.post("/api/assistant/ask", headers=h, json={"question": q}, timeout=120.0)
        except httpx.ReadError as exc:
            errors.append(f"assistant connection reset ({q[:30]}): {exc}")
            continue
        except httpx.TimeoutException:
            errors.append(f"assistant timeout ({q[:30]})")
            continue
        if ra.status_code != 200:
            errors.append(f"assistant ({q[:30]}): {ra.status_code} {ra.text[:200]}")
        else:
            body = ra.json()
            if not body.get("answer"):
                errors.append(f"assistant empty answer for: {q[:40]}")

    rm = c.get("/api/memory", headers=h)
    if rm.status_code != 200:
        errors.append(f"memory list: {rm.status_code}")

    rd = c.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Dup",
            "organization_name": "Dup Org",
        },
    )
    if rd.status_code != 409:
        errors.append(f"dup signup expected 409 got {rd.status_code}")

    # Login demo user + switch org test (optional — requires SEED_DEMO_* in env)
    demo_email = settings.seed_demo_email.strip()
    demo_password = settings.seed_demo_password.strip()
    if demo_email and demo_password:
        lr = c.post("/api/auth/login", json={"email": demo_email, "password": demo_password})
        if lr.status_code == 200:
            h2 = {"Authorization": f"Bearer {lr.json()['access_token']}"}
            orgs = c.get("/api/auth/orgs", headers=h2).json().get("items", [])
            if not orgs:
                errors.append("demo user has no orgs listed")
        else:
            errors.append(f"demo login failed: {lr.status_code}")

    if errors:
        print("ERRORS:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"OK — all API journeys passed (test org slug: {slug})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
