"use client";

import { Calendar, CheckSquare, Square, User } from "lucide-react";
import type { User as ApiUser } from "@/app/lib/api";
import { canCompleteTask, canEditContent, memberApprovalHint } from "@/app/lib/permissions";
import { formatDate } from "@/app/lib/format-locale";
import { useTranslation } from "@/app/lib/use-locale";
import type { I18nKey } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";
import type { ExecutionTask } from "@/components/tasks/task-types";

function priorityLabel(priority: string | undefined, t: (key: I18nKey) => string): string | null {
  if (!priority) return null;
  const labels: Record<string, I18nKey> = {
    low: "priorityLow",
    medium: "priorityMedium",
    high: "priorityHigh",
    urgent: "priorityUrgent",
  };
  const key = labels[priority];
  return key ? t(key) : priority;
}

function formatDueDate(raw: string | null | undefined, locale: import("@/app/lib/i18n").Locale): string | null {
  if (!raw) return null;
  return formatDate(raw, locale);
}

export function ProjectTaskRow({
  task,
  user,
  onToggle,
  onOpen,
  onBlocked,
}: {
  task: ExecutionTask;
  user: ApiUser | null;
  onToggle: (task: ExecutionTask, nextDone: boolean) => void;
  onOpen: (task: ExecutionTask) => void;
  onBlocked: () => void;
}) {
  const { t, locale } = useTranslation();
  const isAdmin = canEditContent(user);
  const isDone = task.status === "done";
  const canToggle = isAdmin || canCompleteTask(user, task);
  const blocked = !canToggle && !isDone;
  const category = priorityLabel(task.priority, t);
  const dueLabel = formatDueDate(task.due_date, locale);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (blocked) {
      onBlocked();
      return;
    }
    if (!isAdmin && isDone) {
      onBlocked();
      return;
    }
    onToggle(task, !isDone);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all duration-150 hover:border-indigo-500/20",
        isDone
          ? "border-slate-200 bg-slate-50/50 opacity-70 dark:border-slate-800/60 dark:bg-slate-900/20"
          : "border-slate-200 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-800",
        blocked && "cursor-not-allowed",
      )}
      title={blocked ? memberApprovalHint() : undefined}
    >
      <button
        type="button"
        aria-label={isDone ? t("taskMarkUndone") : t("taskMarkDone")}
        onClick={handleToggle}
        className={cn(
          "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center",
          blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
      >
        <div className="shrink-0 text-indigo-600 dark:text-indigo-400">
          {isDone ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-xs font-semibold leading-relaxed",
            isDone
              ? "font-medium text-slate-400 line-through dark:text-slate-500"
              : "text-slate-800 dark:text-slate-200",
          )}
        >
          {task.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {task.assignee_name && (
            <span className="inline-flex items-center gap-1 font-mono">
              <User className="h-3.5 w-3.5" />
              {task.assignee_name}
            </span>
          )}
          {dueLabel && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {dueLabel}
            </span>
          )}
          {category && (
            <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider dark:bg-slate-700">
              {category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
