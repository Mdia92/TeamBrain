"use client";

import { FormEvent, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";

export default function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{
    answer: string;
    confidence: number;
    sources: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    try {
      const r = await apiClient.post<typeof answer>("/api/assistant/ask", { question });
      setAnswer(r);
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
      {answer && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <p className="whitespace-pre-wrap">{answer.answer}</p>
          <div className="mt-4 flex items-center gap-4 text-xs text-stone-500">
            <span>Confiance: {Math.round((answer.confidence ?? 0) * 100)}%</span>
            {answer.sources?.length > 0 && (
              <span>Sources: {answer.sources.join(", ")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
