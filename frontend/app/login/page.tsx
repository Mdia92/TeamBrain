"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const user = await login(String(fd.get("email")), String(fd.get("password")));
      if (!user.onboarding_completed) router.push("/onboarding");
      else router.push(`/${user.org_slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4 dark:bg-stone-950">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h1 className="text-2xl font-bold text-amber-800 dark:text-amber-400">{t("login")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("tagline")}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">{t("email")}</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("password")}</label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {loading ? t("loading") : t("login")}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-500">
          Pas de compte ?{" "}
          <Link href="/signup" className="text-amber-700 hover:underline">
            {t("signup")}
          </Link>
        </p>
      </div>
    </div>
  );
}
