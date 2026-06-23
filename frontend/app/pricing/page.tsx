"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/app/lib/utils";
import { MarketingFooter, TeamBrainLogo } from "@/components/marketing-shell";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "À définir",
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
    id: "pro",
    name: "Pro",
    price: "À définir",
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
    id: "enterprise",
    name: "Enterprise",
    price: "Sur devis",
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

export default function PricingPage() {
  const { user } = useAuth();
  const userTier = user?.billing?.pricing_tier as string | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <TeamBrainLogo />
          <Link href="/login" className="tb-btn-secondary text-sm">
            Connexion
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
            Forfaits TeamBrain
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            30 jours d&apos;essai gratuit — toutes les fonctionnalités, sans carte bancaire
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = planMatchesTier(userTier, tier.id);
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
                <p className="mt-2 text-2xl font-semibold text-primary">{tier.price}</p>
                <p className="mt-2 text-sm text-slate-500">{tier.desc}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className={cn(
                    "mt-8 w-full rounded-input py-2.5 text-sm font-medium",
                    tier.highlight
                      ? "bg-primary text-white opacity-60"
                      : "border border-slate-300 text-slate-500 dark:border-slate-700",
                  )}
                >
                  Commencer — bientôt
                </button>
              </div>
            );
          })}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
