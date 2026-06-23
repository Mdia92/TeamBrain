"""Billing — PayDunya checkout."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, require_role
from app.config import settings
from app.payment.paydunya import (
    MerchantNotConfiguredError,
    get_payment_status,
    init_payment,
    is_merchant_configured,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

TIER_PRICES_FCFA = {
    "starter": 5_000,
    "pro": 15_000,
}


class CheckoutIn(BaseModel):
    tier: str = Field(pattern="^(starter|pro)$")


@router.get("/paydunya/status")
async def paydunya_status(user: dict = Depends(get_current_user)) -> dict:
    return {
        "configured": is_merchant_configured(),
        "mode": settings.paydunya_mode,
        "tiers": {k: {"price_fcfa": v, "label": k.capitalize()} for k, v in TIER_PRICES_FCFA.items()},
    }


@router.post("/checkout")
async def start_checkout(
    body: CheckoutIn,
    user: dict = Depends(require_role("owner", "admin")),
) -> dict:
    if not is_merchant_configured():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "No merchant configured",
        )

    amount = TIER_PRICES_FCFA.get(body.tier)
    if not amount:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Forfait invalide")

    org_id = str(user["organization_id"])
    reference = f"{org_id}:{body.tier}:{uuid.uuid4().hex[:12]}"
    base = settings.frontend_url.rstrip("/")
    org_slug = user.get("org_slug") or "app"

    try:
        return await init_payment(
            org_id=org_id,
            amount_fcfa=amount,
            reference=reference,
            description=f"TeamBrain {body.tier.capitalize()} — abonnement mensuel",
            customer_email=user["email"],
            customer_name=user.get("full_name") or user["email"],
            return_url=f"{base}/{org_slug}/settings?tab=billing&payment=success",
            cancel_url=f"{base}/pricing?payment=cancelled",
            tier=body.tier,
        )
    except MerchantNotConfiguredError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc


@router.get("/paydunya/status/{invoice_token}")
async def paydunya_invoice_status(
    invoice_token: str,
    user: dict = Depends(get_current_user),
) -> dict:
    if not is_merchant_configured():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No merchant configured")
    try:
        return await get_payment_status(invoice_token)
    except MerchantNotConfiguredError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
