"use client";

import Link from "next/link";
import { AuthCard } from "@/components/marketing-shell";

export default function SignupPage() {
  return (
    <AuthCard
      title="Inscription sur invitation"
      subtitle="TeamBrain n'accepte pas d'inscription publique. Utilisez l'une des options ci-dessous."
      footer={
        <p className="text-center text-sm text-slate-500">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        <Link
          href="/join"
          className="tb-btn-primary flex h-11 w-full items-center justify-center text-center"
        >
          Rejoindre une équipe (code ou lien)
        </Link>
        <Link
          href="/create"
          className="flex h-11 w-full items-center justify-center rounded-input border border-slate-200 text-center text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Créer un nouvel espace (code pilote requis)
        </Link>
        <p className="text-xs text-slate-500">
          Les nouveaux membres rejoignent via un lien ou un code unique envoyé par un administrateur.
          La création d&apos;organisation nécessite un code d&apos;accès pilote.
        </p>
      </div>
    </AuthCard>
  );
}
