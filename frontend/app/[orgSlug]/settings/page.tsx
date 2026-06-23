"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canManageOrg } from "@/app/lib/permissions";
import { cn } from "@/app/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamInvitesSection } from "@/components/team-invites";
import { PayDunyaCheckoutButton, PayDunyaStatusBadge, TrialUpgradePanel } from "@/components/paydunya-checkout";

const ALL_TABS = [
  { id: "general", label: "Général", adminOnly: false },
  { id: "team", label: "Équipe", adminOnly: true },
  { id: "modules", label: "Modules", adminOnly: true },
  { id: "billing", label: "Facturation", adminOnly: false },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

const MODULE_LABELS: Record<string, string> = {
  projects: "Projets",
  "field-reports": "Rapports terrain",
  meetings: "Réunions",
  documents: "Documents",
  calendar: "Calendrier",
  messages: "Messages",
  whatsapp: "WhatsApp",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Membre" },
  { value: "field_agent", label: "Agent terrain" },
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const isAdmin = canManageOrg(user);
  const tabs = useMemo(() => ALL_TABS.filter((t) => !t.adminOnly || isAdmin), [isAdmin]);
  const [tab, setTab] = useState<TabId>("general");
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingModules, setSavingModules] = useState(false);
  const [paydunya, setPaydunya] = useState<{ configured: boolean; mode: string; tiers?: Record<string, { price_fcfa: number }> } | null>(null);

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab("general");
  }, [tabs, tab]);

  useEffect(() => {
    setModules((user?.settings?.modules as string[]) ?? []);
  }, [user?.settings]);

  useEffect(() => {
    Promise.all([
      apiClient.get<Record<string, unknown>>("/api/organizations/current/billing"),
      apiClient.get<{ configured: boolean; mode: string; tiers?: Record<string, { price_fcfa: number }> }>("/api/billing/paydunya/status"),
      isAdmin ? apiClient.get<{ items: typeof members }>("/api/members") : Promise.resolve({ items: [] }),
    ])
      .then(([b, p, m]) => {
        setBilling(b);
        setPaydunya(p);
        setMembers(m.items);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    void refreshUser();
  }, [refreshUser, isAdmin]);

  async function updateMemberRole(memberId: string, role: string) {
    await apiClient.patch(`/api/members/${memberId}/role`, { role });
    const m = await apiClient.get<{ items: typeof members }>("/api/members");
    setMembers(m.items);
  }

  async function toggleModule(id: string) {
    const next = modules.includes(id) ? modules.filter((m) => m !== id) : [...modules, id];
    setModules(next);
    setSavingModules(true);
    try {
      await apiClient.patch("/api/organizations/current/settings", { modules: next });
      await refreshUser();
    } catch (e) {
      console.error(e);
      setModules((user?.settings?.modules as string[]) ?? []);
    } finally {
      setSavingModules(false);
    }
  }

  const b = billing ?? user?.billing;
  const readOnly = b?.is_read_only === true;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Paramètres" description="Gérez votre organisation, votre équipe et vos modules." />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
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

          {tab === "team" && isAdmin && (
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
                      <select
                        value={m.role}
                        onChange={(e) => void updateMemberRole(m.id, e.target.value)}
                        className="rounded-input border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="tb-card p-6">
                <h2 className="font-semibold">Invitations</h2>
                <div className="mt-4">
                  <TeamInvitesSection />
                </div>
              </section>
            </div>
          )}

          {tab === "modules" && isAdmin && (
            <section className="tb-card p-6">
              <h2 className="font-semibold">Modules actifs</h2>
              <p className="mt-1 text-sm text-slate-500">Les modules désactivés sont masqués dans la navigation.</p>
              <ul className="mt-4 space-y-3">
                {Object.entries(MODULE_LABELS).map(([id, label]) => {
                  const on = modules.includes(id);
                  return (
                    <li key={id} className="flex items-center justify-between rounded-input border border-slate-100 px-4 py-3 dark:border-slate-800">
                      <span className="text-sm font-medium">{label}</span>
                      <button
                        type="button"
                        disabled={savingModules}
                        onClick={() => void toggleModule(id)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          on ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
                        )}
                        aria-pressed={on}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            on ? "translate-x-6" : "translate-x-1",
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {tab === "billing" && (
            <div className="space-y-6">
              {readOnly && <TrialUpgradePanel />}
            <section className="tb-card space-y-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Facturation</h2>
                {paydunya && <PayDunyaStatusBadge configured={paydunya.configured} mode={paydunya.mode} />}
              </div>
              <dl className="space-y-3 text-sm">
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

              {isAdmin && paydunya?.tiers && (
                <div className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                  <h3 className="text-sm font-medium">Passer à un forfait payant</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["starter", "pro"] as const).map((tier) => (
                      <div key={tier} className="rounded-input border border-slate-200 p-4 dark:border-slate-700">
                        <p className="font-medium capitalize">{tier}</p>
                        <p className="text-lg font-semibold text-primary">
                          {paydunya.tiers?.[tier]?.price_fcfa.toLocaleString("fr-FR")} FCFA / mois
                        </p>
                        <PayDunyaCheckoutButton tier={tier} className="mt-3" />
                      </div>
                    ))}
                  </div>
                  {!paydunya.configured && (
                    <p className="text-xs text-slate-500">
                      Configurez PAYDUNYA_API_KEY, PAYDUNYA_MASTER_KEY et PAYDUNYA_TOKEN dans backend/.env
                      pour activer les paiements.
                    </p>
                  )}
                </div>
              )}

              <Link href="/pricing" className="tb-btn-secondary inline-flex h-10">
                Voir tous les forfaits
              </Link>
            </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
