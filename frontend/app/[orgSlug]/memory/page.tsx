"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";

type MemoryItem = {
  id: string;
  type: string;
  note: string;
  strength: number;
  created_at: string;
  source_module: string;
};

type Pattern = { id: string; note: string; strength: number };
type ProjectSummary = { id: string; name: string; memory_count: number };

export default function MemoryPage() {
  const [timeline, setTimeline] = useState<MemoryItem[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryItem[]>([]);

  useEffect(() => {
    apiClient.get<{ items: MemoryItem[] }>("/api/memory").then((d) => setTimeline(d.items)).catch(console.error);
    apiClient.get<{ items: Pattern[] }>("/api/memory/patterns").then((d) => setPatterns(d.items)).catch(console.error);
    apiClient.get<{ items: ProjectSummary[] }>("/api/memory/projects-summary").then((d) => setProjects(d.items)).catch(console.error);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const res = await apiClient.post<{ items: { id: string; note: string; similarity_score: number; type: string; source_module: string }[] }>(
      "/api/memory/search",
      { query, limit: 15 },
    );
    setSearchResults(
      res.items.map((r) => ({
        id: r.id,
        type: r.type,
        note: r.note ?? "",
        strength: 0,
        created_at: "",
        source_module: r.source_module ?? "",
      })),
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mémoire organisationnelle</h1>
        <p className="text-stone-500">Ce que TeamBrain sait de votre organisation</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Recherche sémantique..."
          className="flex-1 rounded-lg border border-stone-300 px-4 py-2 dark:border-stone-700 dark:bg-stone-800"
        />
        <button type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-white">{t("search")}</button>
      </form>

      {searchResults.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="font-semibold">Résultats de recherche</h2>
          <ul className="mt-3 space-y-2">
            {searchResults.map((m) => (
              <li key={m.id} className="rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800">
                <span className="text-xs uppercase text-amber-700">{m.type}</span>
                <p>{m.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {patterns.length > 0 && (
        <section>
          <h2 className="font-semibold">Motifs récurrents</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {patterns.map((p) => (
              <div key={p.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm">{p.note}</p>
                <p className="mt-1 text-xs text-stone-500">Force : {p.strength}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold">Par projet</h2>
        <ul className="mt-3 space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="flex justify-between rounded-lg border border-stone-200 px-4 py-2 dark:border-stone-800">
              <span>{p.name}</span>
              <span className="text-stone-500">{p.memory_count} souvenirs</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">Chronologie récente</h2>
        <ul className="mt-3 space-y-3">
          {timeline.map((m) => (
            <li key={m.id} className="border-l-2 border-amber-400 pl-4">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="uppercase text-amber-700">{m.type}</span>
                <span>{m.source_module}</span>
                {m.strength > 1 && <span>×{m.strength}</span>}
              </div>
              <p className="text-sm">{m.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
