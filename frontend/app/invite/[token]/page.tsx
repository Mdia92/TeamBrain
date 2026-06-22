"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import * as authApi from "@/app/lib/auth-api";
import { t } from "@/app/lib/i18n";

export default function InvitePage() {
  const params = useParams();
  const token = String(params.token);
  const router = useRouter();
  const { applySession } = useAuth();
  const [preview, setPreview] = useState<{
    org_name: string;
    email: string;
    role: string;
    inviter_name?: string;
  } | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi.previewInvite(token).then(setPreview).catch(() => setError("Invitation invalide"));
  }, [token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === "signup") {
        const result = await authApi.acceptInviteSignup({
          token,
          full_name: String(fd.get("full_name")),
          email: String(fd.get("email")),
          password: String(fd.get("password")),
        });
        applySession(result);
        router.push(`/${result.user.org_slug}/dashboard`);
      } else {
        const result = await authApi.acceptInviteLogin({
          token,
          email: String(fd.get("email")),
          password: String(fd.get("password")),
        });
        applySession(result);
        router.push(`/${result.user.org_slug}/dashboard`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!preview && !error) {
    return <div className="flex min-h-screen items-center justify-center"><p>{t("loading")}</p></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4 dark:bg-stone-950">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 dark:border-stone-800 dark:bg-stone-900">
        <h1 className="text-2xl font-bold">Rejoindre {preview?.org_name}</h1>
        {preview?.inviter_name && (
          <p className="mt-2 text-sm text-stone-500">Invité par {preview.inviter_name}</p>
        )}
        <p className="mt-1 text-sm text-stone-500">Rôle : {preview?.role}</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-3 py-1 text-sm ${mode === "signup" ? "bg-amber-100 text-amber-900" : ""}`}
          >
            Créer un compte
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-3 py-1 text-sm ${mode === "login" ? "bg-amber-100 text-amber-900" : ""}`}
          >
            Se connecter
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium">{t("fullName")}</label>
              <input name="full_name" required className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-stone-800" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">{t("email")}</label>
            <input
              name="email"
              type="email"
              required
              defaultValue={preview?.email}
              readOnly={!!preview?.email}
              className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-stone-800"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("password")}</label>
            <input name="password" type="password" required minLength={8} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-stone-800" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-amber-700 py-2 text-white disabled:opacity-50">
            {loading ? t("loading") : "Rejoindre l'organisation"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-amber-700 hover:underline">{t("login")}</Link>
        </p>
      </div>
    </div>
  );
}
