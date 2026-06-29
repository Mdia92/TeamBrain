"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as authApi from "@/app/lib/auth-api";
import { AuthCard } from "@/components/marketing-shell";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const preview = await authApi.previewInviteByCode(code.trim().toUpperCase());
      const token = preview.token;
      if (token) {
        router.push(`/invite/${token}`);
        return;
      }
      setError("Code invalide");
    } catch {
      setError("Code d'invitation invalide ou expiré");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Rejoindre une équipe"
      subtitle="Entrez le code d'invitation reçu de votre administrateur (ex. TB-A1B2C3)"
      footer={
        <p className="text-center text-sm text-slate-500">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
          {" · "}
          <Link href="/create" className="font-medium text-primary hover:underline">
            Créer un espace (code pilote)
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="tb-label" htmlFor="invite_code">
            Code d&apos;invitation équipe
          </label>
          <input
            id="invite_code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="TB-XXXXXX"
            className="tb-input font-mono uppercase tracking-wide"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={loading} className="tb-btn-primary h-10 w-full">
          {loading ? "Vérification…" : "Continuer"}
        </button>
      </form>
    </AuthCard>
  );
}
