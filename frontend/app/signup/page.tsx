"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { AuthCard } from "@/components/marketing-shell";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    const confirm = String(fd.get("confirm_password"));
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      setLoading(false);
      return;
    }
    try {
      await signup({
        email: String(fd.get("email")),
        password,
        full_name: String(fd.get("full_name")),
        organization_name: String(fd.get("organization_name")),
      });
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Créer mon compte"
      subtitle="Rejoignez TeamBrain en quelques minutes"
      footer={
        <p className="text-center text-sm text-slate-500">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
          {" · "}
          <Link href="/create" className="font-medium text-primary hover:underline">
            Créer un espace
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="tb-label" htmlFor="organization_name">
            {t("organizationName")}
          </label>
          <input id="organization_name" name="organization_name" required className="tb-input" />
        </div>
        <div>
          <label className="tb-label" htmlFor="full_name">
            {t("fullName")}
          </label>
          <input id="full_name" name="full_name" required className="tb-input" />
        </div>
        <div>
          <label className="tb-label" htmlFor="email">
            {t("email")}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="tb-input" />
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
            minLength={8}
            autoComplete="new-password"
            className="tb-input"
          />
        </div>
        <div>
          <label className="tb-label" htmlFor="confirm_password">
            Confirmer le mot de passe
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="tb-input"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={loading} className="tb-btn-primary h-10 w-full">
          {loading ? t("loading") : "Créer mon compte"}
        </button>
      </form>
    </AuthCard>
  );
}
