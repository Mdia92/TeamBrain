"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { postAuthPath } from "@/app/lib/auth-routes";
import { useTranslation } from "@/app/lib/use-locale";
import { AuthCard } from "@/components/marketing-shell";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const user = await login(String(fd.get("email")), String(fd.get("password")));
      router.push(postAuthPath(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      footer={
        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-primary hover:underline">
            ← {t("loginBackHome")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="tb-label" htmlFor="email">
            {t("email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="tb-input"
            placeholder="vous@organisation.sn"
          />
        </div>
        <div>
          <label className="tb-label" htmlFor="password">
            {t("password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="tb-input"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={loading} className="tb-btn-primary h-10 w-full">
          {loading ? t("loading") : t("login")}
        </button>
      </form>

      <div className="mt-8 space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:bg-slate-900">
              {t("loginNewMember")}
            </span>
          </div>
        </div>

        <Link
          href="/join"
          className="flex h-10 w-full items-center justify-center rounded-input border border-slate-200 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {t("loginJoinTeam")}
        </Link>
        <p className="text-center text-xs leading-relaxed text-slate-500">{t("loginInviteOnlyHint")}</p>
        <p className="text-center text-xs text-slate-400">
          <Link href="/create" className="text-primary hover:underline">
            {t("loginCreateOrg")}
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
