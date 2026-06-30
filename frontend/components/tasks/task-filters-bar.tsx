"use client";

import { Search } from "lucide-react";
import { useTranslation } from "@/app/lib/use-locale";
import { cn } from "@/app/lib/utils";
import type { StatusFilter } from "@/components/tasks/task-types";

const FILTERS: { id: StatusFilter; key: "tasksFilterAll" | "tasksFilterTodo" | "tasksFilterInProgress" | "tasksFilterDone" }[] = [
  { id: "all", key: "tasksFilterAll" },
  { id: "todo", key: "tasksFilterTodo" },
  { id: "in_progress", key: "tasksFilterInProgress" },
  { id: "done", key: "tasksFilterDone" },
];

export function TaskFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("tasksSearchPlaceholder")}
          className="tb-input h-10 pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onStatusFilterChange(f.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
            )}
          >
            {t(f.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
