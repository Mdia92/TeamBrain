"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { apiClient } from "@/app/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/app/lib/use-locale";
import {
  MemoryGasTimeline,
  MemorySearchBar,
  type MemoryDisplayItem,
  type MemoryFilter,
} from "@/components/memory/memory-gas-timeline";

function mapMemoryType(raw: string): MemoryFilter {
  if (raw === "pattern") return "pattern";
  if (raw === "episodic") return "commitment";
  return "decision";
}

export default function MemoryPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [timeline, setTimeline] = useState<MemoryDisplayItem[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryDisplayItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<MemoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const { t, locale } = useTranslation();

  const refreshMemory = useCallback(() => {
    const typeParam = typeFilter === "pattern" ? "pattern" : typeFilter === "commitment" ? "episodic" : undefined;
    const url = typeParam ? `/api/memory?type_filter=${typeParam}` : "/api/memory";
    return apiClient
      .get<{ items: MemoryDisplayItem[] }>(url)
      .then((tl) => setTimeline(tl.items))
      .catch(console.error);
  }, [typeFilter]);

  useEffect(() => {
    void refreshMemory().finally(() => setLoading(false));
    const timer = setInterval(() => {
      if (!query.trim()) void refreshMemory();
    }, 30_000);
    return () => clearInterval(timer);
  }, [query, refreshMemory]);

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
    const timer = setTimeout(() => void runSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const baseItems = query.trim() ? searchResults : timeline;
  const displayItems = useMemo(() => {
    if (typeFilter === "all") return baseItems;
    return baseItems.filter((m) => mapMemoryType(m.type) === typeFilter);
  }, [baseItems, typeFilter]);

  function openMemory(item: MemoryDisplayItem) {
    const mod = item.source_module;
    if (mod === "tasks" || mod === "projects") router.push(`/${orgSlug}/tasks`);
    else if (mod === "documents" || mod === "field_reports") router.push(`/${orgSlug}/documents`);
    else if (mod === "meetings") router.push(`/${orgSlug}/meetings`);
    else if (mod === "messages") router.push(`/${orgSlug}/messages`);
    else if (mod === "calendar") router.push(`/${orgSlug}/calendar`);
    else router.push(`/${orgSlug}/assistant`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <CardSkeleton lines={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MemorySearchBar
        query={query}
        onQueryChange={setQuery}
        filter={typeFilter}
        onFilterChange={setTypeFilter}
        searching={searching}
      />

      {displayItems.length === 0 && !query.trim() ? (
        <EmptyState icon={Brain} title={t("memoryEmptyTitle")} description={t("memoryEmptyDesc")} />
      ) : (
        <MemoryGasTimeline items={displayItems} locale={locale} onOpen={openMemory} />
      )}

      {displayItems.length === 0 && query.trim() && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-indigo-400"
          >
            {t("memoryClearSearch")}
          </button>
        </div>
      )}
    </div>
  );
}
