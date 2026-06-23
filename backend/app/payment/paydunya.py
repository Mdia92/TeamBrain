"""PayDunya payment gateway — skeleton ready for merchant account keys."""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from typing import Any

import httpx

from app.config import settings

PAYDUNYA_API = "https://app.paydunya.com/api/v1"


class MerchantNotConfiguredError(Exception):
    """Raised when PayDunya merchant keys are missing."""


def is_merchant_configured() -> bool:
    return bool(
        settings.paydunya_api_key
        and settings.paydunya_master_key
        and settings.paydunya_token
    )


def _require_merchant() -> None:
    if not is_merchant_configured():
        raise MerchantNotConfiguredError("No merchant configured")


def _headers() -> dict[str, str]:
    return {
        "PAYDUNYA-MASTER-KEY": settings.paydunya_master_key,
        "PAYDUNYA-PRIVATE-KEY": settings.paydunya_api_key,
        "PAYDUNYA-TOKEN": settings.paydunya_token,
        "Content-Type": "application/json",
    }


async def init_payment(
    *,
    org_id: str,
    amount_fcfa: int,
    reference: str,
    description: str,
    customer_email: str,
    customer_name: str,
    return_url: str,
    cancel_url: str,
    tier: str,
) -> dict[str, Any]:
    """Create a PayDunya checkout invoice and return checkout URL + token."""
    _require_merchant()

    payload = {
        "invoice": {
            "total_amount": amount_fcfa,
            "description": description,
            "items": {
                "item_0": {
                    "name": description,
                    "quantity": 1,
                    "unit_price": str(amount_fcfa),
                    "total_price": str(amount_fcfa),
                },
            },
        },
        "store": {"name": "TeamBrain"},
        "custom_data": {
            "organization_id": org_id,
            "tier": tier,
            "reference": reference,
        },
        "actions": {"cancel_url": cancel_url, "return_url": return_url},
        "customers": {
            "customer_0": {"name": customer_name, "email": customer_email},
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{PAYDUNYA_API}/checkout-invoice/create",
            headers=_headers(),
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

    token = data.get("token") or str(uuid.uuid4())
    checkout_url = data.get("response_text") or f"https://app.paydunya.com/sandbox-checkout/{token}"
    return {
        "checkout_url": checkout_url,
        "invoice_token": token,
        "reference": reference,
        "sandbox_mode": settings.paydunya_mode == "sandbox",
    }


def verify_webhook(payload: dict[str, Any], signature: str | None) -> bool:
    """Validate PayDunya IPN signature when merchant keys are configured."""
    if not is_merchant_configured():
        return False
    if not signature:
        return settings.paydunya_mode == "sandbox"
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    expected = hmac.new(
        settings.paydunya_master_key.encode(),
        body.encode(),
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def get_payment_status(invoice_token: str) -> dict[str, Any]:
    """Check whether a PayDunya invoice has been paid."""
    _require_merchant()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{PAYDUNYA_API}/checkout-invoice/confirm/{invoice_token}",
            headers=_headers(),
        )
        r.raise_for_status()
        data = r.json()
    status = data.get("status") or data.get("invoice", {}).get("status") or "unknown"
    return {
        "invoice_token": invoice_token,
        "status": status,
        "paid": status in ("completed", "paid", "success"),
        "raw": data,
    }
