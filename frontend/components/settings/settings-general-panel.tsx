"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BellRing,
  Building,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  WifiOff,
} from "lucide-react";
import * as authApi from "@/app/lib/auth-api";
import { useTranslation } from "@/app/lib/use-locale";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/app/lib/utils";

function PrefToggle({
  on,
  onToggle,
  title,
  description,
  icon: Icon,
  iconClassName,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <h4 className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-white">
          <Icon className={cn("h-3.5 w-3.5 text-slate-400", iconClassName)} />
          {title}
        </h4>
        <p className="text-[10px] leading-normal text-slate-400 dark:text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 cursor-pointer text-indigo-600 focus:outline-none dark:text-indigo-400"
        aria-pressed={on}
      >
        {on ? (
          <ToggleRight className="h-9 w-9" />
        ) : (
          <ToggleLeft className="h-9 w-9 text-slate-300 dark:text-slate-700" />
        )}
      </button>
    </div>
  );
}

export function SettingsGeneralPanel({
  orgSlug,
  orgName: initialName,
  orgDescription: initialDescription,
  orgSector: initialSector,
  orgLocation: initialLocation,
  isAdmin,
  onSaved,
}: {
  orgSlug: string;
  orgName: string;
  orgDescription: string;
  orgSector: string;
  orgLocation: string;
  isAdmin: boolean;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [mission, setMission] = useState(initialDescription);
  const [sector, setSector] = useState(initialSector);
  const [location, setLocation] = useState(initialLocation);
  const [saving, setSaving] = useState(false);

  const prefKey = `tb-settings-prefs-${orgSlug}`;
  const [liveSync, setLiveSync] = useState(true);
  const [autoIndexing, setAutoIndexing] = useState(true);
  const [offlineOpt, setOfflineOpt] = useState(false);
  const [accessSecurity, setAccessSecurity] = useState(true);

  useEffect(() => {
    setName(initialName);
    setMission(initialDescription);
    setSector(initialSector);
    setLocation(initialLocation);
  }, [initialName, initialDescription, initialSector, initialLocation]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefKey);
      if (!raw) return;
      const p = JSON.parse(raw) as Record<string, boolean>;
      if (typeof p.liveSync === "boolean") setLiveSync(p.liveSync);
      if (typeof p.autoIndexing === "boolean") setAutoIndexing(p.autoIndexing);
      if (typeof p.offlineOpt === "boolean") setOfflineOpt(p.offlineOpt);
      if (typeof p.accessSecurity === "boolean") setAccessSecurity(p.accessSecurity);
    } catch {
      /* ignore */
    }
  }, [prefKey]);

  function persistPrefs(next: Record<string, boolean>) {
    localStorage.setItem(prefKey, JSON.stringify(next));
  }

  function togglePref(
    key: "liveSync" | "autoIndexing" | "offlineOpt" | "accessSecurity",
    value: boolean,
    setter: (v: boolean) => void,
  ) {
    setter(value);
    persistPrefs({
      liveSync: key === "liveSync" ? value : liveSync,
      autoIndexing: key === "autoIndexing" ? value : autoIndexing,
      offlineOpt: key === "offlineOpt" ? value : offlineOpt,
      accessSecurity: key === "accessSecurity" ? value : accessSecurity,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !mission.trim()) {
      toast(t("settingsRequiredNameMission"), "error");
      return;
    }
    setSaving(true);
    try {
      await authApi.patchOrgSettings({
        name: name.trim(),
        org_description: mission.trim(),
        org_sector: sector.trim(),
        org_location: location.trim(),
      });
      await onSaved();
      toast(t("settingsProfileSaved"), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t("errorGeneric"), "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Settings className="h-5 w-5 text-indigo-500" />
          {t("settingsGeneralTitle")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{t("settingsGeneralDesc")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("settingsIdentitySection")}
          </span>

          {isAdmin ? (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850"
            >
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  <Building className="h-3.5 w-3.5" />
                  {t("settingsOrgName")} *
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("settingsOrgNamePlaceholder")}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {t("settingsMission")} *
                </label>
                <input
                  required
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  placeholder={t("settingsMissionPlaceholder")}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {t("settingsSector")}
                  </label>
                  <input
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder={t("settingsSectorPlaceholder")}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {t("settingsLocation")}
                  </label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t("settingsLocationPlaceholder")}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-3.5 dark:border-slate-800/80">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? t("settingsSavingProfile") : t("settingsSaveProfile")}
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-sm shadow-xs dark:border-slate-800 dark:bg-slate-850">
              <div>
                <dt className="text-slate-500">{t("settingsOrgName")}</dt>
                <dd className="font-medium">{name}</dd>
              </div>
              {mission && (
                <div>
                  <dt className="text-slate-500">{t("settingsMission")}</dt>
                  <dd>{mission}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="space-y-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("settingsSystemPrefs")}
          </span>
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
            <PrefToggle
              on={liveSync}
              onToggle={() => togglePref("liveSync", !liveSync, setLiveSync)}
              title={t("settingsLiveSync")}
              description={t("settingsLiveSyncDesc")}
              icon={BellRing}
            />
            <PrefToggle
              on={autoIndexing}
              onToggle={() => togglePref("autoIndexing", !autoIndexing, setAutoIndexing)}
              title={t("settingsAutoIndexing")}
              description={t("settingsAutoIndexingDesc")}
              icon={Sparkles}
              iconClassName="text-indigo-500"
            />
            <PrefToggle
              on={offlineOpt}
              onToggle={() => togglePref("offlineOpt", !offlineOpt, setOfflineOpt)}
              title={t("settingsOfflineOpt")}
              description={t("settingsOfflineOptDesc")}
              icon={WifiOff}
            />
            <PrefToggle
              on={accessSecurity}
              onToggle={() => togglePref("accessSecurity", !accessSecurity, setAccessSecurity)}
              title={t("settingsAccessSecurity")}
              description={t("settingsAccessSecurityDesc")}
              icon={ShieldCheck}
            />
            {isAdmin && (
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => toast(t("settingsResetMemory"), "info")}
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 py-2 text-[10px] font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("settingsResetMemory")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
