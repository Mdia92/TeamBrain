"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/app/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamInvitesSection } from "@/components/team-invites";

const TABS = [
  { id: "general", label: "Général" },
  { id: "team", label: "Équipe" },
  { id: "modules", label: "Modules" },
  { id: "billing", label: "Facturation" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MODULE_LABELS: Record<string, string> = {
  projects: "Projets",
  "field-reports": "Rapports terrain",
  meetings: "Réunions",
  documents: "Documents",
  calendar: "Calendrier",
  whatsapp: "WhatsApp",
};

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<TabId>("general");
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<Record<string, unknown>>("/api/organizations/current/billing"),
      user?.role === "owner" || user?.role === "admin"
        ? apiClient.get<{ items: typeof members }>("/api/members")
        : Promise.resolve({ items: [] }),
    ])
      .then(([b, m]) => {
        setBilling(b);
        setMembers(m.items);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    void refreshUser();
  }, [refreshUser, user?.role]);

  const b = billing ?? user?.billing;
  const modules = (user?.settings?.modules as string[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Paramètres" description="Gérez votre organisation, votre équipe et vos modules." />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {tab === "general" && (
            <section className="tb-card space-y-4 p-6">
              <h2 className="font-semibold">Organisation</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Nom</dt>
                  <dd className="font-medium">{user?.org_name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Identifiant</dt>
                  <dd className="font-medium">{user?.org_slug}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Votre rôle</dt>
                  <dd className="font-medium capitalize">{user?.role}</dd>
                </div>
              </dl>
            </section>
          )}

          {tab === "team" && (
            <div className="space-y-6">
              <section className="tb-card p-6">
                <h2 className="font-semibold">Membres</h2>
                <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      <Avatar name={m.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{m.full_name}</p>
                        <p className="truncate text-xs text-slate-500">{m.email}</p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium capitalize text-primary dark:bg-indigo-950">
                        {m.role}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="tb-card p-6">
                <h2 className="font-semibold">Invitations</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Invitez des collègues par email avec un lien unique.
                </p>
                <div className="mt-4">
                  <TeamInvitesSection />
                </div>
              </section>
            </div>
          )}

          {tab === "modules" && (
            <section className="tb-card p-6">
              <h2 className="font-semibold">Modules actifs</h2>
              <p className="mt-1 text-sm text-slate-500">
                Les modules désactivés sont masqués dans la navigation.
              </p>
              <ul className="mt-4 space-y-3">
                {Object.entries(MODULE_LABELS).map(([id, label]) => {
                  const on = modules.includes(id);
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between rounded-input border border-slate-100 px-4 py-3 dark:border-slate-800"
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <span
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          on ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
                        )}
                        aria-hidden
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            on ? "translate-x-6" : "translate-x-1",
                          )}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs text-slate-400">
                Contactez le support pour modifier les modules après l&apos;onboarding.
              </p>
            </section>
          )}

          {tab === "billing" && (
            <section className="tb-card p-6">
              <h2 className="font-semibold">Facturation</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800">
                  <dt className="text-slate-500">Forfait</dt>
                  <dd className="font-medium">{String(b?.pricing_tier ?? "free_trial")}</dd>
                </div>
                {b?.trial_days_left != null && (
                  <div className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800">
                    <dt className="text-slate-500">Jours restants (essai)</dt>
                    <dd className="font-medium">{String(b.trial_days_left)}</dd>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Mode</dt>
                  <dd className="font-medium">{b?.is_read_only ? "Lecture seule" : "Actif"}</dd>
                </div>
              </dl>
              <Link href="/pricing" className="tb-btn-primary mt-6 inline-flex h-10">
                Voir les forfaits
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
