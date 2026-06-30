"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as authApi from "@/app/lib/auth-api";
import { useTranslation } from "@/app/lib/use-locale";
import { AuthCard } from "@/components/marketing-shell";

export default function JoinPage() {
  const router = useRouter();
  const { t } = useTranslation();
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
      setError(t("joinInvalidCode"));
    } catch {
      setError(t("joinInvalidCode"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("joinTitle")}
      subtitle={t("joinSubtitle")}
      footer={
        <p className="text-center text-sm text-slate-500">
          {t("joinHasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("login")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="tb-label" htmlFor="invite_code">
            {t("joinCodeLabel")}
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
          {loading ? t("joinVerifying") : t("joinVerify")}
        </button>
      </form>
      <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">{t("loginInviteOnlyHint")}</p>
    </AuthCard>
  );
}
