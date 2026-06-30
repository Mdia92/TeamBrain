"use client";

import { Calendar, Search, X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { formatDate } from "@/app/lib/format-locale";
import { useTranslation } from "@/app/lib/use-locale";
import type { I18nKey, Locale } from "@/app/lib/i18n";

export type MemoryDisplayItem = {
  id: string;
  type: string;
  note: string;
  strength: number;
  created_at: string;
  source_module: string;
};

export type MemoryFilter = "all" | "decision" | "commitment" | "pattern";

function mapMemoryType(raw: string): MemoryFilter {
  if (raw === "pattern") return "pattern";
  if (raw === "episodic") return "commitment";
  return "decision";
}

function parseNote(note: string): { title: string; body: string; category: string } {
  const lines = note.split("\n").filter(Boolean);
  const first = lines[0] ?? note;
  const title = first.length > 90 ? `${first.slice(0, 87)}…` : first;
  const body = lines.slice(1).join("\n") || first;
  const category = lines.find((l) => l.includes(":"))?.split(":")[0]?.trim() ?? "";
  return { title, body, category };
}

function typeBadge(type: MemoryFilter, t: (k: I18nKey) => string): string {
  if (type === "pattern") return t("memoryPatternDetected");
  if (type === "commitment") return t("memoryCommitment");
  return t("memoryDecision");
}

export function MemoryGasTimeline({
  items,
  locale,
  onOpen,
}: {
  items: MemoryDisplayItem[];
  locale: Locale;
  onOpen: (item: MemoryDisplayItem) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-850">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{t("memoryNoMatch")}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute bottom-0 left-4 top-0 w-px border-l border-dashed border-slate-200 dark:border-slate-800 md:left-1/2 md:-translate-x-1/2" />
      <div className="relative z-10 space-y-8">
        {items.map((item, idx) => {
          const mapped = mapMemoryType(item.type);
          const isLeft = idx % 2 === 0;
          const parsed = parseNote(item.note);
          const isPattern = mapped === "pattern";
          const isCommitment = mapped === "commitment";

          return (
            <div
              key={item.id}
              className={cn("flex w-full flex-col gap-4 md:items-start", isLeft ? "md:flex-row-reverse" : "md:flex-row")}
            >
              <div className="hidden md:block md:w-1/2" />
              <div
                className={cn(
                  "absolute left-2 top-1.5 z-20 h-4 w-4 rounded-full border-4 border-white shadow-xs dark:border-slate-900 md:left-1/2 md:-translate-x-1/2",
                  isPattern && "bg-amber-500",
                  !isPattern && isCommitment && "bg-emerald-500",
                  !isPattern && !isCommitment && "bg-indigo-600",
                )}
              />
              <div className="w-full pl-10 md:w-1/2 md:px-6 md:pl-0">
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className={cn(
                    "w-full rounded-xl border p-5 text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-md",
                    isPattern
                      ? "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/5"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 uppercase tracking-wider",
                        isPattern &&
                          "border-amber-200/20 bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                        !isPattern &&
                          isCommitment &&
                          "border-emerald-200/20 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                        !isPattern &&
                          !isCommitment &&
                          "border-indigo-200/20 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
                      )}
                    >
                      {typeBadge(mapped, t)}
                    </span>
                    {item.created_at && (
                      <span className="flex items-center gap-1 font-mono text-slate-400">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {formatDate(item.created_at, locale)}
                      </span>
                    )}
                  </div>
                  {parsed.category && (
                    <span className="mt-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {parsed.category}
                    </span>
                  )}
                  <h3 className="mt-0.5 text-sm font-extrabold leading-snug text-slate-900 dark:text-white">
                    {parsed.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{parsed.body}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {item.source_module && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        #{item.source_module}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {t("memoryValidation")} :
                      </span>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              i < (item.strength || 1)
                                ? isPattern
                                  ? "bg-amber-500"
                                  : isCommitment
                                    ? "bg-emerald-500"
                                    : "bg-indigo-600"
                                : "bg-slate-200 dark:bg-slate-700",
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MemorySearchBar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  searching,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filter: MemoryFilter;
  onFilterChange: (f: MemoryFilter) => void;
  searching?: boolean;
}) {
  const { t } = useTranslation();
  const filters: { id: MemoryFilter; key: I18nKey }[] = [
    { id: "all", key: "memoryFilterAll" },
    { id: "decision", key: "memoryFilterDecision" },
    { id: "commitment", key: "memoryFilterCommitment" },
    { id: "pattern", key: "memoryFilterPattern" },
  ];

  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850 md:flex-row">
      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("memorySearchGas")}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={cn(
                "rounded-md px-3 py-1 text-[10px] font-bold transition-all",
                filter === f.id
                  ? f.id === "pattern"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
