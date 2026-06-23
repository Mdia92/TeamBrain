"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { TeamInvitesSection } from "@/components/team-invites";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    apiClient.get<Record<string, unknown>>("/api/organizations/current/billing").then(setBilling).catch(console.error);
    void refreshUser();
  }, [refreshUser]);

  const b = billing ?? user?.billing;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Paramètres de l&apos;organisation</h1>

      <section className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="font-semibold">Équipe et invitations</h2>
        <p className="mt-1 text-sm text-stone-500">
          Invitez des collègues par email. Ils recevront un lien unique pour rejoindre cette organisation.
        </p>
        <div className="mt-4">
          <TeamInvitesSection />
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="font-semibold">Facturation</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Forfait</dt>
            <dd className="font-medium">{String(b?.pricing_tier ?? "free_trial")}</dd>
          </div>
          {b?.trial_days_left != null && (
            <div className="flex justify-between">
              <dt className="text-stone-500">Jours restants (essai)</dt>
              <dd className="font-medium">{String(b.trial_days_left)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-stone-500">Mode</dt>
            <dd className="font-medium">{b?.is_read_only ? "Lecture seule" : "Actif"}</dd>
          </div>
        </dl>
        <Link href="/pricing" className="mt-4 inline-block text-sm text-amber-700 hover:underline">
          Voir les forfaits →
        </Link>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="font-semibold">Modules actifs</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {((user?.settings?.modules as string[]) ?? []).map((m) => (
            <li key={m}>✓ {m}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
