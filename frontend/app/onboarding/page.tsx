"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import * as authApi from "@/app/lib/auth-api";
import { t } from "@/app/lib/i18n";

const QUESTIONS = [
  {
    key: "org_type",
    label: "Type d'organisation",
    options: [
      { value: "company", label: "Entreprise" },
      { value: "ngo", label: "ONG" },
      { value: "government", label: "Gouvernement" },
      { value: "other", label: "Autre" },
    ],
  },
  {
    key: "team_size",
    label: "Taille de l'équipe",
    options: [
      { value: "1-5", label: "1-5" },
      { value: "6-20", label: "6-20" },
      { value: "21-50", label: "21-50" },
      { value: "50+", label: "50+" },
    ],
  },
  {
    key: "work_style",
    label: "Mode de travail",
    options: [
      { value: "office-only", label: "Bureau uniquement" },
      { value: "field-only", label: "Terrain uniquement" },
      { value: "hybrid", label: "Hybride bureau + terrain" },
    ],
  },
  {
    key: "primary_language",
    label: "Langue principale",
    options: [
      { value: "fr", label: "Français" },
      { value: "en", label: "English" },
      { value: "both", label: "Les deux" },
    ],
  },
  {
    key: "key_pain",
    label: "Principal défi",
    options: [
      { value: "project_tracking", label: "Suivi de projets" },
      { value: "team_coordination", label: "Coordination d'équipe" },
      { value: "document_management", label: "Gestion documentaire" },
      { value: "field_reporting", label: "Rapports terrain" },
      { value: "all", label: "Tout" },
    ],
  },
];

export default function OnboardingPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isLoading && user?.onboarding_completed && user.org_slug) {
      router.replace(`/${user.org_slug}/dashboard`);
    }
  }, [user, isLoading, router]);

  async function handleFinish() {
    setSubmitting(true);
    try {
      await authApi.completeOnboarding({
        org_type: answers.org_type ?? "company",
        team_size: answers.team_size ?? "6-20",
        work_style: answers.work_style ?? "hybrid",
        primary_language: answers.primary_language ?? "fr",
        key_pain: answers.key_pain ?? "all",
      });
      const updated = await refreshUser();
      router.push(`/${updated?.org_slug ?? user?.org_slug}/dashboard`);
    } finally {
      setSubmitting(false);
    }
  }

  const q = QUESTIONS[step];
  if (!q) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4 dark:bg-stone-950">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 dark:border-stone-800 dark:bg-stone-900">
        <p className="text-sm text-amber-700">Étape {step + 1} / {QUESTIONS.length}</p>
        <h1 className="mt-2 text-xl font-bold">{t("onboardingTitle")}</h1>
        <p className="mt-4 font-medium">{q.label}</p>
        <div className="mt-4 space-y-2">
          {q.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAnswers((a) => ({ ...a, [q.key]: opt.value }))}
              className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                answers[q.key] === opt.value
                  ? "border-amber-600 bg-amber-50 dark:bg-amber-950"
                  : "border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-between">
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="text-sm text-stone-500">
              Retour
            </button>
          ) : (
            <span />
          )}
          {step < QUESTIONS.length - 1 ? (
            <button
              type="button"
              disabled={!answers[q.key]}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("continue")}
            </button>
          ) : (
            <button
              type="button"
              disabled={!answers[q.key] || submitting}
              onClick={() => void handleFinish()}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? t("loading") : "Terminer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
