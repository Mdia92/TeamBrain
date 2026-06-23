"use client";

import { FormEvent, useState } from "react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";

type AssistantAnswer = {
  answer: string;
  confidence: number;
  confidence_label: string;
  sources: string[];
  api_configured?: boolean;
  actions_taken?: string[];
  grounded?: boolean;
};

function confidenceBadgeClass(label: string): string {
  if (label === "Haute") return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (label === "Moyenne") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

export default function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    try {
      const r = await apiClient.post<AssistantAnswer>("/api/assistant/ask", { question });
      setAnswer(r);
    } catch (err) {
      setAnswer(null);
      setError(err instanceof ApiRequestError ? err.message : "Erreur de l'assistant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("assistant")}</h1>
      <p className="text-sm text-stone-500">
        Posez des questions sur vos projets, tâches, rapports terrain et réunions.
      </p>
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("askAssistant")}
          className="flex-1 rounded-lg border px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
        />
        <button type="submit" disabled={loading} className="rounded-lg bg-amber-700 px-6 py-3 text-white disabled:opacity-50">
          {loading ? "..." : "Demander"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {answer && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          {answer.api_configured === false && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Configurez une clé API dans les paramètres (GEMINI, GROQ ou MISTRAL).
            </p>
          )}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-stone-500">Confiance</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(answer.confidence_label ?? "Faible")}`}
            >
              {answer.confidence_label ?? "Faible"} ({Math.round((answer.confidence ?? 0) * 100)}%)
            </span>
          </div>
          <p className="whitespace-pre-wrap">{answer.answer}</p>
          {answer.actions_taken && answer.actions_taken.length > 0 && (
            <div className="mt-4 rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800">
              <p className="font-medium">Actions exécutées</p>
              <ul className="mt-1 list-inside list-disc text-stone-600 dark:text-stone-400">
                {answer.actions_taken.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {answer.sources?.length > 0 && (
            <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Sources</p>
              <ul className="mt-2 space-y-1 text-xs text-stone-600 dark:text-stone-400">
                {answer.sources.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
