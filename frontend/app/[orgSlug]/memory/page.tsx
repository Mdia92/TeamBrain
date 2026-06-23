"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brain, Search } from "lucide-react";
import { apiClient } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { TbCard } from "@/components/ui/tb-card";
import { useGsapStagger } from "@/hooks/use-gsap-stagger";

type MemoryItem = {
  id: string;
  type: string;
  note: string;
  strength: number;
  created_at: string;
  source_module: string;
};

type Pattern = { id: string; note: string; strength: number };

function StrengthBar({ strength }: { strength: number }) {
  const max = 5;
  const level = Math.min(max, Math.max(1, strength));
  return (
    <div className="flex gap-0.5" title={`Force : ${strength}`}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-3 rounded-full",
            i < level ? "bg-accent" : "bg-slate-200 dark:bg-slate-700",
          )}
        />
      ))}
    </div>
  );
}

export default function MemoryPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [timeline, setTimeline] = useState<MemoryItem[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get<{ items: MemoryItem[] }>("/api/memory"),
      apiClient.get<{ items: Pattern[] }>("/api/memory/patterns"),
    ])
      .then(([tl, pat]) => {
        setTimeline(tl.items);
        setPatterns(pat.items);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.post<{
        items: { id: string; note: string; type: string; source_module: string; similarity_score: number }[];
      }>("/api/memory/search", { query: q, limit: 15 });
      setSearchResults(
        res.items.map((r) => ({
          id: r.id,
          type: r.type,
          note: r.note ?? "",
          strength: Math.round((r.similarity_score ?? 0) * 5) || 1,
          created_at: "",
          source_module: r.source_module ?? "",
        })),
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(query), 350);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const displayItems = query.trim() ? searchResults : timeline;
  const timelineRef = useGsapStagger<HTMLOListElement>([displayItems.length, loading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <CardSkeleton lines={5} />
      </div>
    );
  }

  function openMemory(item: MemoryItem) {
    const mod = item.source_module;
    if (mod === "tasks" || mod === "projects") router.push(`/${orgSlug}/tasks`);
    else if (mod === "documents" || mod === "field_reports") router.push(`/${orgSlug}/documents`);
    else if (mod === "meetings") router.push(`/${orgSlug}/meetings`);
    else if (mod === "messages") router.push(`/${orgSlug}/messages`);
    else if (mod === "calendar") router.push(`/${orgSlug}/calendar`);
    else router.push(`/${orgSlug}/assistant`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mémoire organisationnelle"
        description="Ce que TeamBrain sait de votre organisation — chronologie et motifs."
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Recherche instantanée..."
          className="tb-input h-10 pl-10"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">...</span>
        )}
      </div>

      {patterns.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Motifs récurrents</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {patterns.map((p) => (
              <TbCard key={p.id} stagger interactive onClick={() => router.push(`/${orgSlug}/assistant`)} className="border-l-4 border-l-accent bg-amber-50/30 p-4 dark:bg-amber-950/10">
                <p className="text-sm">{p.note}</p>
                <div className="mt-3">
                  <StrengthBar strength={p.strength} />
                </div>
              </TbCard>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {query.trim() ? "Résultats" : "Chronologie"}
        </h2>
        {displayItems.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="Aucun souvenir pour l'instant"
            description="Les actions de votre équipe alimenteront automatiquement la mémoire organisationnelle."
          />
        ) : (
          <ol ref={timelineRef} className="relative border-l-2 border-indigo-200 pl-6 dark:border-indigo-900">
            {displayItems.map((m) => (
              <li key={m.id} className="relative mb-8 last:mb-0 gsap-stagger-item">
                <span className="absolute -left-[1.6rem] top-1 flex h-3 w-3 rounded-full bg-primary ring-4 ring-white dark:ring-slate-950" />
                <TbCard interactive onClick={() => openMemory(m)} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium uppercase text-primary dark:bg-indigo-950">
                        {m.type}
                      </span>
                      {m.source_module && <span>{m.source_module}</span>}
                      {m.created_at && (
                        <span>{new Date(m.created_at).toLocaleDateString("fr-FR")}</span>
                      )}
                    </div>
                    <StrengthBar strength={m.strength || 1} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">{m.note}</p>
                </TbCard>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
