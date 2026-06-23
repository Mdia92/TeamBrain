"""PayDunya payment skeleton tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.payment.paydunya import MerchantNotConfiguredError, is_merchant_configured, verify_webhook

client = TestClient(app, raise_server_exceptions=False)


def test_merchant_not_configured_by_default():
    assert is_merchant_configured() is False


def test_checkout_returns_403_without_merchant():
    r = client.post("/api/billing/checkout", json={"tier": "starter"})
    assert r.status_code in (401, 403)


def test_webhook_returns_403_without_merchant():
    r = client.post("/api/webhooks/paydunya", json={"status": "completed"})
    assert r.status_code == 403
    assert r.json()["detail"] == "No merchant configured"


def test_verify_webhook_false_when_unconfigured():
    assert verify_webhook({"status": "completed"}, "sig") is False


def test_init_payment_raises_when_unconfigured():
    import asyncio

    from app.payment.paydunya import init_payment

    async def _run():
        await init_payment(
            org_id="00000000-0000-0000-0000-000000000001",
            amount_fcfa=5000,
            reference="ref-1",
            description="Test",
            customer_email="a@test.sn",
            customer_name="Test",
            return_url="http://localhost:3010/ok",
            cancel_url="http://localhost:3010/cancel",
            tier="starter",
        )

    with pytest.raises(MerchantNotConfiguredError):
        asyncio.run(_run())
