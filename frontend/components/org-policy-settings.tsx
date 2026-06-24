"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";

type PolicyView = {
  defaults: Record<string, number>;
  overrides: Record<string, number>;
  effective: Record<string, number>;
};

type PolicyField = {
  key: keyof PolicyView["effective"];
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

const FIELDS: PolicyField[] = [
  {
    key: "overdue_task_days",
    label: "Retard tâche",
    help: "Nombre de jours après l'échéance avant d'envoyer un rappel de retard.",
    min: 0,
    max: 90,
    step: 1,
    unit: "jours",
  },
  {
    key: "commitment_reminder_hours_before",
    label: "Rappel d'engagement",
    help: "Heures avant l'échéance pour rappeler un engagement de réunion.",
    min: 1,
    max: 168,
    step: 1,
    unit: "heures",
  },
  {
    key: "field_report_gap_days",
    label: "Écart rapport terrain",
    help: "Jours sans rapport terrain avant d'alerter l'agent et son manager.",
    min: 1,
    max: 90,
    step: 1,
    unit: "jours",
  },
  {
    key: "memory_dedup_similarity",
    label: "Déduplication mémoire",
    help: "Seuil de similarité (0–1) pour fusionner deux notes mémoire proches.",
    min: 0.5,
    max: 1,
    step: 0.01,
  },
  {
    key: "memory_decay_months",
    label: "Décroissance mémoire",
    help: "Âge en mois au-delà duquel les souvenirs peu renforcés sont atténués.",
    min: 1,
    max: 36,
    step: 1,
    unit: "mois",
  },
  {
    key: "assistant_confidence_min",
    label: "Confiance assistant (mémoire)",
    help: "Seuil minimal de pertinence mémoire pour qu'une source compte dans une réponse Xam.",
    min: 0.1,
    max: 1,
    step: 0.05,
  },
  {
    key: "auto_action_confidence_min",
    label: "Confiance actions suggérées",
    help: "Seuil minimal de confiance pour proposer une action (tâche, rappel WhatsApp, etc.).",
    min: 0.1,
    max: 1,
    step: 0.05,
  },
];

export function OrgPolicySettings() {
  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient
      .get<PolicyView>("/api/organizations/current/policy")
      .then((r) => {
        setPolicy(r);
        setDraft(r.effective);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!policy) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const patch: Record<string, number> = {};
    for (const f of FIELDS) {
      const def = policy.defaults[f.key];
      const eff = policy.effective[f.key];
      const val = draft[f.key];
      if (val === def && eff !== def) {
        patch[f.key] = val;
      } else if (val !== def) {
        patch[f.key] = val;
      }
    }
    try {
      const r = await apiClient.patch<PolicyView>("/api/organizations/current/policy", patch);
      setPolicy(r);
      setDraft(r.effective);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function resetField(key: string) {
    if (!policy) return;
    setDraft((d) => ({ ...d, [key]: policy.defaults[key] }));
  }

  if (loading) return <p className="text-sm text-slate-500">Chargement des règles…</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Règles organisationnelles — valeurs par défaut TeamBrain, personnalisables par votre organisation.
        Les jobs de rappel et Xam utilisent ces seuils.
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Règles enregistrées.</p>}
      <ul className="space-y-6">
        {FIELDS.map((f) => {
          const value = draft[f.key] ?? policy?.effective[f.key] ?? 0;
          const isOverride = policy && value !== policy.defaults[f.key];
          return (
            <li key={f.key} className="rounded-input border border-slate-100 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{f.help}</p>
                </div>
                {isOverride && (
                  <button
                    type="button"
                    onClick={() => resetField(f.key)}
                    className="text-xs text-primary hover:underline"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={value}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [f.key]: f.step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10),
                    }))
                  }
                  className="min-w-[160px] flex-1 accent-primary"
                />
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={value}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [f.key]: f.step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10),
                    }))
                  }
                  className="tb-input w-24"
                />
                {f.unit && <span className="text-xs text-slate-500">{f.unit}</span>}
                <span className={cn("text-xs", isOverride ? "text-amber-600" : "text-slate-400")}>
                  défaut {policy?.defaults[f.key]}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={saving} onClick={() => void save()} className="tb-btn-primary h-10">
        {saving ? "Enregistrement…" : "Enregistrer les règles"}
      </button>
    </div>
  );
}
