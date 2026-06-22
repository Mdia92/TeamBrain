"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-500">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-stone-950">
      <header className="border-b border-stone-200 bg-white px-6 py-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xl font-bold text-amber-800 dark:text-amber-400">{t("appName")}</span>
          <div className="flex gap-3">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300">
              {t("login")}
            </Link>
            <Link
              href="/create"
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Créer votre espace
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          La mémoire collective de votre équipe
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-600 dark:text-stone-400">
          {t("tagline")}. Projets, terrain, réunions et WhatsApp unifiés dans un cerveau organisationnel
          qui s&apos;enrichit avec le temps.
        </p>
        <Link
          href="/create"
          className="mt-8 rounded-xl bg-amber-700 px-8 py-3 text-lg font-medium text-white hover:bg-amber-800"
        >
          Créer votre espace — 30 jours gratuits
        </Link>
        <p className="mt-4 text-sm text-stone-500">Sans carte bancaire · Français par défaut</p>
      </main>
    </div>
  );
}
