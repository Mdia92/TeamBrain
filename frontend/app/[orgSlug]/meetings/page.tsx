"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient, uploadFile } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";

type Meeting = {
  id: string;
  title: string;
  date: string;
  ai_summary: string;
  processing_status: string;
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ summary: string; tasks_created: string[] } | null>(null);

  const load = () => apiClient.get<{ items: Meeting[] }>("/api/meetings").then((r) => setMeetings(r.items));
  useEffect(() => { void load(); }, []);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const form = new FormData();
    form.append("title", String(fd.get("title")));
    form.append("audio", fd.get("audio") as File);
    const projectId = fd.get("project_id");
    if (projectId) form.append("project_id", String(projectId));
    try {
      const r = await uploadFile("/api/meetings", form) as { summary: string; tasks_created: string[] };
      setResult(r);
      e.currentTarget.reset();
      void load();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("meetings")}</h1>
      <form onSubmit={handleUpload} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3 dark:border-stone-800 dark:bg-stone-900">
        <input name="title" placeholder="Titre de la réunion" required className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
        <input name="audio" type="file" accept="audio/*" required className="text-sm" />
        <button type="submit" disabled={uploading} className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50">
          {uploading ? "Traitement en cours..." : "Téléverser et analyser"}
        </button>
      </form>
      {result && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <h3 className="font-semibold">Résumé IA</h3>
          <p className="mt-1 text-sm">{result.summary}</p>
          <p className="mt-2 text-sm text-stone-600">{result.tasks_created.length} tâche(s) créée(s)</p>
        </div>
      )}
      <div className="space-y-2">
        {meetings.map((m) => (
          <div key={m.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <h3 className="font-medium">{m.title}</h3>
            <p className="text-sm text-stone-500">{new Date(m.date).toLocaleString("fr")} — {m.processing_status}</p>
            {m.ai_summary && <p className="mt-1 text-sm">{m.ai_summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
