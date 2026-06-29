"use client";

import { FormEvent, useState } from "react";
import { ApiRequestError, isApiMisconfiguredForBrowser } from "@/app/lib/api";
import { validateInviteCode } from "@/app/lib/auth-api";

type Props = {
  onValidated: (code: string) => void;
  submitLabel?: string;
};

export function InviteCodeForm({ onValidated, submitLabel = "Continuer" }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const misconfigured = isApiMisconfiguredForBrowser();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (misconfigured) {
      setError(
        "Configuration API manquante — définissez NEXT_PUBLIC_API_URL sur Vercel (URL Railway).",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await validateInviteCode(code.trim());
      if (!result.valid) {
        setError(result.message || "Code d'invitation invalide");
        return;
      }
      onValidated(code.trim());
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 0) {
        setError("Impossible de joindre l'API — vérifiez NEXT_PUBLIC_API_URL et CORS_ORIGINS.");
      } else if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Code d'invitation invalide");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {misconfigured && (
        <p className="rounded-input border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Le site ne pointe pas vers l&apos;API de production (NEXT_PUBLIC_API_URL).
        </p>
      )}
      <div>
        <label className="tb-label" htmlFor="invite_code">
          Code d&apos;invitation pilote
        </label>
        <input
          id="invite_code"
          name="invite_code"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoComplete="off"
          className="tb-input"
        />
        <p className="mt-1 text-xs text-slate-500">
          Code fourni par l&apos;équipe Timtimol — ne le partagez pas publiquement.
        </p>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={loading || !code.trim()} className="tb-btn-primary h-10 w-full">
        {loading ? "Vérification…" : submitLabel}
      </button>
    </form>
  );
}
