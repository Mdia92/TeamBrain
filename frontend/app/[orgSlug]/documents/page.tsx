"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient, uploadFile } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";

type Doc = { id: string; title: string; file_url: string; ai_summary: string | null };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Doc[] | null>(null);

  const load = () => apiClient.get<{ items: Doc[] }>("/api/documents").then((r) => setDocs(r.items));
  useEffect(() => { void load(); }, []);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File;
    if (!file?.size) return;
    const form = new FormData();
    form.append("file", file);
    form.append("title", String(fd.get("title") || file.name));
    await uploadFile("/api/documents", form);
    e.currentTarget.reset();
    void load();
  }

  async function handleSearch() {
    if (!query.trim()) { setSearchResults(null); return; }
    const r = await apiClient.get<{ items: Doc[] }>(`/api/documents/search?q=${encodeURIComponent(query)}`);
    setSearchResults(r.items);
  }

  async function handleSummarize(id: string) {
    const r = await apiClient.post<{ summary: string }>(`/api/documents/${id}/summarize`);
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ai_summary: r.summary } : d)));
  }

  const display = searchResults ?? docs;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("documents")}</h1>
      <form onSubmit={handleUpload} className="flex flex-wrap gap-2 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <input name="title" placeholder="Titre" className="rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
        <input name="file" type="file" required className="text-sm" />
        <button type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white">{t("upload")}</button>
      </form>
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="flex-1 rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
        <button onClick={() => void handleSearch()} className="rounded-lg border px-4 py-2 text-sm">{t("search")}</button>
      </div>
      <div className="space-y-3">
        {display.map((d) => (
          <div key={d.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-start justify-between">
              <h3 className="font-medium">{d.title}</h3>
              <button onClick={() => void handleSummarize(d.id)} className="text-xs text-amber-700 hover:underline">
                Résumer (IA)
              </button>
            </div>
            {d.ai_summary && <p className="mt-2 text-sm text-stone-500">{d.ai_summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
