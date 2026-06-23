"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Brain, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { MarketingFooter, TeamBrainLogo } from "@/components/marketing-shell";
import { Skeleton } from "@/components/ui/skeleton";

const FEATURES = [
  {
    icon: Brain,
    title: "Mémoire",
    description:
      "Chaque action terrain, réunion et message enrichit un cerveau organisationnel qui ne s'efface pas.",
  },
  {
    icon: MapPin,
    title: "Coordination",
    description:
      "Projets, rapports offline, calendrier et messagerie — une seule source de vérité pour vos équipes.",
  },
  {
    icon: Sparkles,
    title: "Intelligence",
    description:
      "Assistant IA ancré dans vos données réelles : qui doit livrer, décisions, rappels WhatsApp.",
  },
];

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      if (!user.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }
      router.replace(`/${user.org_slug ?? "app"}/dashboard`);
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <TeamBrainLogo />
          <div className="flex items-center gap-2">
            <Link href="/login" className="tb-btn-secondary hidden sm:inline-flex">
              {t("login")}
            </Link>
            <Link href="/create" className="tb-btn-primary h-10">
              Créer votre espace
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 py-16 text-center md:py-24">
          <p className="mb-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-primary dark:bg-indigo-950">
            Conçu pour les ONG et organisations terrain en Afrique
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl lg:text-6xl">
            Votre équipe ne devrait jamais oublier
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            TeamBrain unifie projets, terrain, réunions et messages dans une mémoire organisationnelle
            qui s&apos;enrichit avec le temps — pour que rien ne se perde entre les missions.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/create" className="tb-btn-primary h-11 px-8 text-base">
              Créer votre espace
            </Link>
            <Link href="/pricing" className="tb-btn-secondary h-11 px-8 text-base">
              Voir les forfaits
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">30 jours gratuits · Sans carte bancaire · Français par défaut</p>
        </section>

        {/* Features */}
        <section className="border-t border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="tb-card p-6 text-left">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 text-primary dark:bg-indigo-950">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Prêt à donner une mémoire à votre organisation ?
          </h2>
          <Link href="/create" className="tb-btn-primary mt-6 inline-flex h-11 px-8 text-base">
            Commencer gratuitement
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
