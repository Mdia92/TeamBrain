"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/app/lib/utils";
import { MarketingFooter, TeamBrainLogo } from "@/components/marketing-shell";
import { PayDunyaCheckoutButton, PayDunyaStatusBadge } from "@/components/paydunya-checkout";

const TIERS = [
  {
    id: "starter" as const,
    name: "Starter",
    priceFcfa: 5_000,
    desc: "Petites équipes terrain, modules essentiels",
    features: [
      "Jusqu'à 5 utilisateurs",
      "Mémoire organisationnelle",
      "Rapports terrain offline",
      "Projets et tâches",
      "Support email",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    priceFcfa: 15_000,
    desc: "Organisations en croissance, IA avancée",
    features: [
      "Utilisateurs illimités",
      "Assistant IA agentique",
      "WhatsApp gateway",
      "Réunions IA + extraction",
      "Priorité support",
    ],
    highlight: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    priceFcfa: null,
    desc: "Multi-sites, SLA, intégrations sur mesure",
    features: [
      "SSO et audit avancé",
      "Support dédié",
      "Déploiement on-premise possible",
      "Formation équipe",
      "SLA personnalisé",
    ],
  },
];

function planMatchesTier(userTier: string | undefined, tierId: string): boolean {
  if (!userTier) return false;
  const map: Record<string, string> = {
    free_trial: "starter",
    starter: "starter",
    pro: "pro",
    enterprise: "enterprise",
  };
  return map[userTier] === tierId;
}

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default function PricingPage() {
  const { user } = useAuth();
  const userTier = user?.billing?.pricing_tier as string | undefined;
  const [paydunya, setPaydunya] = useState<{ configured: boolean; mode: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    apiClient
      .get<{ configured: boolean; mode: string }>("/api/billing/paydunya/status")
      .then(setPaydunya)
      .catch(() => setPaydunya({ configured: false, mode: "sandbox" }));
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <TeamBrainLogo />
          <Link href={user ? `/${user.org_slug}/dashboard` : "/login"} className="tb-btn-secondary text-sm">
            {user ? "Tableau de bord" : "Connexion"}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
            Forfaits TeamBrain
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            30 jours d&apos;essai gratuit — paiement sécurisé via PayDunya (Orange Money, Wave, carte)
          </p>
          {paydunya && (
            <div className="mt-4 flex justify-center">
              <PayDunyaStatusBadge configured={paydunya.configured} mode={paydunya.mode} />
            </div>
          )}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = planMatchesTier(userTier, tier.id);
            const priceLabel =
              tier.priceFcfa != null ? `${formatFcfa(tier.priceFcfa)} / mois` : "Sur devis";
            return (
              <div
                key={tier.id}
                className={cn(
                  "relative flex flex-col rounded-modal border p-6 transition-all",
                  tier.highlight
                    ? "border-primary bg-white shadow-dropdown dark:bg-slate-900"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
                  isCurrent && "ring-2 ring-primary",
                )}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-white">
                    Plan actuel
                  </span>
                )}
                {tier.highlight && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-slate-900">
                    Populaire
                  </span>
                )}
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{tier.name}</h2>
                <p className="mt-2 text-2xl font-semibold text-primary">{priceLabel}</p>
                <p className="mt-2 text-sm text-slate-500">{tier.desc}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                {tier.id === "enterprise" ? (
                  <a
                    href="mailto:contact@teambrain.app?subject=TeamBrain%20Enterprise"
                    className="mt-8 w-full rounded-input border border-slate-300 py-2.5 text-center text-sm font-medium dark:border-slate-700"
                  >
                    Nous contacter
                  </a>
                ) : (
                  <PayDunyaCheckoutButton
                    tier={tier.id}
                    highlight={tier.highlight}
                    label={user ? "Payer avec PayDunya" : "Se connecter pour payer"}
                    className="mt-8"
                  />
                )}
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-slate-500">
          Les paiements sont traités par PayDunya conformément à la réglementation UEMOA. TVA applicable selon
          votre statut fiscal au Sénégal. Consultez nos{" "}
          <Link href="/legal/cgu" className="text-primary hover:underline">
            CGU
          </Link>{" "}
          et notre{" "}
          <Link href="/legal/confidentialite" className="text-primary hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
