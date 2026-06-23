"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canManageOrg } from "@/app/lib/permissions";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/app/lib/utils";

type CheckoutResult = {
  checkout_url?: string;
  invoice_token?: string;
};

export function PayDunyaCheckoutButton({
  tier,
  label,
  highlight = false,
  className,
  compact = false,
}: {
  tier: "starter" | "pro";
  label?: string;
  highlight?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isAdmin = canManageOrg(user);

  async function handleCheckout() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!isAdmin) {
      toast("Seuls les administrateurs peuvent souscrire un forfait", "info");
      return;
    }
    setLoading(true);
    try {
      const r = await apiClient.post<CheckoutResult>("/api/billing/checkout", { tier });
      if (r.checkout_url) {
        window.location.href = r.checkout_url;
        return;
      }
      toast("Réponse PayDunya incomplète", "error");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        toast("Paiement indisponible — compte marchand PayDunya non configuré", "info");
        return;
      }
      toast(err instanceof ApiRequestError ? err.message : "Erreur de paiement", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleCheckout()}
      className={cn(
        compact ? "rounded-input px-4 py-2 text-sm font-medium" : "w-full rounded-input py-2.5 text-sm font-medium",
        "transition-opacity disabled:opacity-60",
        highlight ? "bg-primary text-white hover:opacity-90" : "border border-slate-300 dark:border-slate-700",
        className,
      )}
    >
      {loading ? "Redirection…" : label ?? "Payer avec PayDunya"}
    </button>
  );
}

export function PayDunyaStatusBadge({ configured, mode }: { configured: boolean; mode: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        configured
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      )}
    >
      PayDunya {configured ? `(${mode})` : "— compte marchand non configuré"}
    </span>
  );
}

export function TrialUpgradePanel({ className }: { className?: string }) {
  const { user } = useAuth();
  const billing = user?.billing;
  if (!billing?.is_read_only) return null;

  return (
    <div
      className={cn(
        "rounded-modal border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/50",
        className,
      )}
    >
      <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
        Passez à un forfait pour continuer
      </h3>
      <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
        Votre essai gratuit est terminé. Choisissez un forfait et payez via PayDunya (Orange Money, Wave, carte).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-input border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900">
          <p className="font-medium">Starter</p>
          <p className="text-lg font-semibold text-primary">5 000 FCFA / mois</p>
          <PayDunyaCheckoutButton tier="starter" className="mt-3" />
        </div>
        <div className="rounded-input border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900">
          <p className="font-medium">Pro</p>
          <p className="text-lg font-semibold text-primary">15 000 FCFA / mois</p>
          <PayDunyaCheckoutButton tier="pro" highlight className="mt-3" />
        </div>
      </div>
      <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
        Sans clés PayDunya en local, le paiement renvoie « compte marchand non configuré » — structure prête pour la
        production.
      </p>
    </div>
  );
}
