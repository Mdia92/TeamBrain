"use client";

import { Sparkles } from "lucide-react";
import { useTranslation } from "@/app/lib/use-locale";
import type { User } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";
import { ProjectTaskRow } from "@/components/tasks/project-task-row";
import { computeProgress, type ExecutionProject, type ExecutionTask } from "@/components/tasks/task-types";

export function ProjectProgressCard({
  project,
  tasks,
  allTasks,
  user,
  subtitle,
  searchActive,
  onProjectClick,
  onTaskToggle,
  onTaskOpen,
  onTaskBlocked,
  className,
}: {
  project: Pick<ExecutionProject, "id" | "name" | "description" | "client_name" | "status">;
  tasks: ExecutionTask[];
  allTasks: ExecutionTask[];
  user: User | null;
  subtitle?: string;
  searchActive?: boolean;
  onProjectClick?: () => void;
  onTaskToggle: (task: ExecutionTask, nextDone: boolean) => void;
  onTaskOpen: (task: ExecutionTask) => void;
  onTaskBlocked: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const progress = computeProgress(allTasks);
  const doneCount = allTasks.filter((x) => x.status === "done").length;

  return (
    <article
      className={cn(
        "flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div>
        <div className="mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onProjectClick}
            disabled={!onProjectClick}
            className={cn("w-full text-left", onProjectClick && "cursor-pointer")}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400">
                {project.name}
              </h3>
              <span className="shrink-0 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                {progress}% {t("tasksProgressDone")}
              </span>
            </div>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
            {project.description && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {project.description}
              </p>
            )}
            {project.client_name && (
              <p className="mt-1 text-xs text-slate-500">{t("clientLabel")} : {project.client_name}</p>
            )}
          </button>
        </div>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500 dark:bg-indigo-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("workPlanSection")} ({tasks.length} {t("tasksCountUnit")})
          </span>

          {tasks.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-slate-400 dark:text-slate-500">
              {searchActive ? t("tasksNoSearchResults") : t("tasksNoTasksOnProject")}
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <ProjectTaskRow
                  key={task.id}
                  task={task}
                  user={user}
                  onToggle={onTaskToggle}
                  onOpen={onTaskOpen}
                  onBlocked={onTaskBlocked}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {allTasks.length > 0 && (
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-400 dark:border-slate-800/80">
          <span className="flex items-center gap-1 font-mono">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            {t("tasksLiveUpdate")}
          </span>
          <span>
            {doneCount}/{allTasks.length} {t("tasksValidated")}
          </span>
        </div>
      )}
    </article>
  );
}
