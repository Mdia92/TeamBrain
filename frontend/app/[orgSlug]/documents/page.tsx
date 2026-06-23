"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { apiClient, uploadFile } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";

type Doc = { id: string; title: string; file_url: string; ai_summary: string | null };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Doc[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    apiClient
      .get<{ items: Doc[] }>("/api/documents")
      .then((r) => setDocs(r.items))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

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
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const r = await apiClient.get<{ items: Doc[] }>(`/api/documents/search?q=${encodeURIComponent(query)}`);
    setSearchResults(r.items);
  }

  async function handleSummarize(id: string) {
    const r = await apiClient.post<{ summary: string }>(`/api/documents/${id}/summarize`);
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ai_summary: r.summary } : d)));
  }

  const display = searchResults ?? docs;

  if (loading) return <CardSkeleton lines={4} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("documents")} description="Stockez et résumez vos documents avec l'IA." />
      <form onSubmit={handleUpload} className="tb-card flex flex-wrap items-end gap-4 p-6">
        <div className="min-w-[200px] flex-1">
          <label className="tb-label" htmlFor="doc-title">
            Titre
          </label>
          <input id="doc-title" name="title" placeholder="Titre du document" className="tb-input" />
        </div>
        <div>
          <label className="tb-label" htmlFor="doc-file">
            Fichier
          </label>
          <input id="doc-file" name="file" type="file" required className="text-sm" />
        </div>
        <button type="submit" className="tb-btn-primary h-10">
          {t("upload")}
        </button>
      </form>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          className="tb-input flex-1"
        />
        <button type="button" onClick={() => void handleSearch()} className="tb-btn-secondary">
          {t("search")}
        </button>
      </div>
      {display.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun document" description="Téléversez votre premier fichier pour commencer." />
      ) : (
        <div className="space-y-3">
          {display.map((d) => (
            <div key={d.id} className="tb-card p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-medium">{d.title}</h3>
                <button
                  type="button"
                  onClick={() => void handleSummarize(d.id)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Résumer (IA)
                </button>
              </div>
              {d.ai_summary && <p className="mt-2 text-sm text-slate-500">{d.ai_summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
