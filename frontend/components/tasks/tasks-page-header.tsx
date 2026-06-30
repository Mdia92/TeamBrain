"use client";

import { ListTodo, Plus, Search } from "lucide-react";
import { useTranslation } from "@/app/lib/use-locale";
import { cn } from "@/app/lib/utils";
import type { StatusFilter } from "@/components/tasks/task-types";

const FILTERS: {
  id: StatusFilter;
  key: "tasksFilterAll" | "tasksFilterTodo" | "tasksFilterInProgress" | "tasksFilterDone";
}[] = [
  { id: "all", key: "tasksFilterAll" },
  { id: "todo", key: "tasksFilterTodo" },
  { id: "in_progress", key: "tasksFilterInProgress" },
  { id: "done", key: "tasksFilterDone" },
];

export function TasksPageHeader({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAddTask,
  showFilters = true,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  onAddTask?: () => void;
  showFilters?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="w-full md:w-auto">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <ListTodo className="h-5 w-5 text-indigo-500" />
            {t("tasksPageTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{t("tasksPageSubtitle")}</p>
        </div>

        <div className="flex w-full items-center justify-end gap-3 md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("tasksSearchPlaceholder")}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              {t("tasksNewTaskButton")}
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onStatusFilterChange(f.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                statusFilter === f.id
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
              )}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
