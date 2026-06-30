"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import * as authApi from "@/app/lib/auth-api";
import { useTranslation } from "@/app/lib/use-locale";
import { useToast } from "@/components/ui/toast";

export function ChangePasswordForm({
  forced = false,
  onSuccess,
}: {
  forced?: boolean;
  onSuccess?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("passwordMinLength"));
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      toast(t("passwordChanged"), "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {forced && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {t("changePasswordForcedHint")}
        </p>
      )}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {t("currentPassword")}
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {t("newPassword")}
        </label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {t("confirmPassword")}
        </label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-60"
      >
        <KeyRound className="h-3.5 w-3.5" />
        {loading ? t("loading") : t("changePasswordButton")}
      </button>
    </form>
  );
}

export function SettingsPasswordPanel() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <KeyRound className="h-4 w-4 text-indigo-500" />
        {t("changePasswordTitle")}
      </h3>
      <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{t("changePasswordDesc")}</p>
      <div className="mt-4">
        <ChangePasswordForm onSuccess={() => refreshUser()} />
      </div>
    </div>
  );
}
