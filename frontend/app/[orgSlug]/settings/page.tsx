"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canManageOrg } from "@/app/lib/permissions";
import { useTranslation } from "@/app/lib/use-locale";
import type { I18nKey } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamInvitesSection } from "@/components/team-invites";
import { PayDunyaCheckoutButton, PayDunyaStatusBadge, TrialUpgradePanel } from "@/components/paydunya-checkout";
import { OrgPolicySettings } from "@/components/org-policy-settings";
import { AutomationBuilder } from "@/components/automation-builder";
import { SettingsGeneralPanel } from "@/components/settings/settings-general-panel";

const ALL_TABS: { id: string; labelKey: I18nKey; adminOnly: boolean }[] = [
  { id: "general", labelKey: "settingsTabGeneral", adminOnly: false },
  { id: "team", labelKey: "settingsTabTeam", adminOnly: true },
  { id: "modules", labelKey: "settingsTabModules", adminOnly: true },
  { id: "rules", labelKey: "settingsTabRules", adminOnly: true },
  { id: "automations", labelKey: "settingsTabAutomations", adminOnly: true },
  { id: "billing", labelKey: "settingsTabBilling", adminOnly: false },
];

type TabId = (typeof ALL_TABS)[number]["id"];

const MODULE_LABEL_KEYS: Record<string, I18nKey> = {
  projects: "projects",
  "field-reports": "fieldReports",
  meetings: "meetings",
  documents: "documents",
  messages: "messages",
  calendar: "calendar",
  whatsapp: "whatsappModule",
};

const ROLE_OPTIONS: { value: string; labelKey: I18nKey }[] = [
  { value: "admin", labelKey: "roleAdmin" },
  { value: "manager", labelKey: "roleManager" },
  { value: "member", labelKey: "roleMember" },
  { value: "field_agent", labelKey: "roleFieldAgent" },
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = user?.org_slug ?? "";
  const isAdmin = canManageOrg(user);
  const tabs = useMemo(() => ALL_TABS.filter((tab) => !tab.adminOnly || isAdmin), [isAdmin]);
  const [tab, setTab] = useState<TabId>("general");
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingModules, setSavingModules] = useState(false);
  const [paydunya, setPaydunya] = useState<{ configured: boolean; mode: string; tiers?: Record<string, { price_fcfa: number }> } | null>(null);

  useEffect(() => {
    if (user && !isAdmin) {
      router.replace(`/${user.org_slug}/dashboard`);
    }
  }, [user, isAdmin, router]);

  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && tabs.some((x) => x.id === fromUrl)) setTab(fromUrl as TabId);
  }, [searchParams, tabs]);

  useEffect(() => {
    if (!tabs.some((x) => x.id === tab)) setTab("general");
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

  function selectTab(id: TabId) {
    setTab(id);
    const base = `/${orgSlug}/settings`;
    router.replace(id === "general" ? base : `${base}?tab=${id}`);
  }

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

  const settings = user?.settings as Record<string, unknown> | undefined;
  const b = billing ?? user?.billing;
  const readOnly = b?.is_read_only === true;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => selectTab(x.id as TabId)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === x.id
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            {t(x.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {tab === "general" && (
            <SettingsGeneralPanel
              orgSlug={orgSlug}
              orgName={user?.org_name ?? ""}
              orgDescription={String(settings?.org_description ?? "")}
              orgSector={String(settings?.org_sector ?? "")}
              orgLocation={String(settings?.org_location ?? "")}
              isAdmin={isAdmin}
              onSaved={async () => {
                await refreshUser();
              }}
            />
          )}

          {tab === "team" && isAdmin && (
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
                <h2 className="font-semibold text-slate-900 dark:text-white">{t("settingsMembersActive")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("settingsMembersHint")}</p>
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
                          <option key={r.value} value={r.value}>
                            {t(r.labelKey)}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
                <h2 className="font-semibold text-slate-900 dark:text-white">{t("settingsPendingInvites")}</h2>
                <div className="mt-4">
                  <TeamInvitesSection />
                </div>
              </section>
            </div>
          )}

          {tab === "modules" && isAdmin && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("settingsModulesTitle")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("settingsModulesHint")}</p>
              <ul className="mt-4 space-y-3">
                {Object.entries(MODULE_LABEL_KEYS).map(([id, labelKey]) => {
                  const on = modules.includes(id);
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 dark:border-slate-800"
                    >
                      <span className="text-sm font-medium">{t(labelKey)}</span>
                      <button
                        type="button"
                        disabled={savingModules}
                        onClick={() => void toggleModule(id)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          on ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600",
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

          {tab === "rules" && isAdmin && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("settingsRulesTitle")}</h2>
              <div className="mt-4">
                <OrgPolicySettings />
              </div>
            </section>
          )}

          {tab === "automations" && isAdmin && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("settingsAutomationsTitle")}</h2>
              <div className="mt-4">
                <AutomationBuilder />
              </div>
            </section>
          )}

          {tab === "billing" && (
            <div className="space-y-6">
              {readOnly && <TrialUpgradePanel />}
              <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{t("settingsBillingTitle")}</h2>
                  {paydunya && <PayDunyaStatusBadge configured={paydunya.configured} mode={paydunya.mode} />}
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800">
                    <dt className="text-slate-500">{t("settingsPlan")}</dt>
                    <dd className="font-medium">{String(b?.pricing_tier ?? "free_trial")}</dd>
                  </div>
                  {b?.trial_days_left != null && (
                    <div className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800">
                      <dt className="text-slate-500">{t("settingsTrialDays")}</dt>
                      <dd className="font-medium">{String(b.trial_days_left)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <dt className="text-slate-500">{t("settingsMode")}</dt>
                    <dd className="font-medium">
                      {b?.is_read_only ? t("settingsReadOnlyMode") : t("settingsActiveMode")}
                    </dd>
                  </div>
                </dl>

                {isAdmin && paydunya?.tiers && (
                  <div className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                    <h3 className="text-sm font-medium">{t("settingsUpgradePaid")}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["starter", "pro"] as const).map((tier) => (
                        <div key={tier} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                          <p className="font-medium capitalize">{tier}</p>
                          <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                            {paydunya.tiers?.[tier]?.price_fcfa.toLocaleString("fr-FR")} FCFA / mois
                          </p>
                          <PayDunyaCheckoutButton tier={tier} className="mt-3" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link href="/pricing" className="tb-btn-secondary inline-flex h-10">
                  {t("settingsViewPlans")}
                </Link>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
