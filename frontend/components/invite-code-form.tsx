"use client";

import { FormEvent, useState } from "react";
import { validateInviteCode } from "@/app/lib/auth-api";

type Props = {
  onValidated: (code: string) => void;
  submitLabel?: string;
};

export function InviteCodeForm({ onValidated, submitLabel = "Continuer" }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await validateInviteCode(code.trim());
      if (!result.valid) {
        setError("Code d'invitation invalide");
        return;
      }
      onValidated(code.trim());
    } catch {
      setError("Code d'invitation invalide");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="tb-label" htmlFor="invite_code">
          Code d&apos;invitation
        </label>
        <input
          id="invite_code"
          name="invite_code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoComplete="off"
          placeholder="TIMTIMOL2026"
          className="tb-input"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={loading || !code.trim()} className="tb-btn-primary h-10 w-full">
        {loading ? "Vérification…" : submitLabel}
      </button>
    </form>
  );
}
