"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { AuthCard } from "@/components/marketing-shell";

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
    <AuthCard
      title="Se connecter"
      subtitle={t("tagline")}
      footer={
        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-primary hover:underline">
            ← Retour à l&apos;accueil
          </Link>
          <span className="mx-2">·</span>
          Pas de compte ?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Créer un compte
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="tb-label" htmlFor="email">
            {t("email")}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="tb-input" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
              {t("password")}
            </label>
            <Link href="/login" className="text-xs text-primary hover:underline" title="Bientôt disponible">
              Mot de passe oublié ?
            </Link>
          </div>
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
          {loading ? t("loading") : "Se connecter"}
        </button>
      </form>
    </AuthCard>
  );
}
