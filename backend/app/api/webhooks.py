"""External webhooks — PayDunya IPN."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.payment.paydunya import is_merchant_configured, verify_webhook

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

PAID_STATUSES = frozenset({"completed", "paid", "success"})


@router.post("/paydunya")
async def paydunya_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict:
    if not is_merchant_configured():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "No merchant configured",
        )

    payload = await request.json()
    signature = request.headers.get("PAYDUNYA-SIGNATURE") or request.headers.get("X-Paydunya-Signature")
    if not verify_webhook(payload, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Signature webhook invalide")

    invoice_status = (
        payload.get("status")
        or payload.get("invoice", {}).get("status")
        or payload.get("data", {}).get("status")
        or ""
    ).lower()
    if invoice_status not in PAID_STATUSES:
        return {"status": "ignored", "invoice_status": invoice_status}

    custom = payload.get("custom_data") or payload.get("invoice", {}).get("custom_data") or {}
    org_id = custom.get("organization_id")
    tier = custom.get("tier")
    if not org_id or tier not in ("starter", "pro", "enterprise"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Métadonnées de paiement invalides")

    await session.execute(
        text(
            "UPDATE organizations SET pricing_tier = :tier, plan = :tier"
            " WHERE id = CAST(:oid AS uuid)"
        ).bindparams(tier=tier, oid=str(org_id)),
    )
    await session.commit()
    return {"status": "ok", "organization_id": str(org_id), "pricing_tier": tier}
