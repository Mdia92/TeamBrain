"use client";

import { useTranslation } from "@/app/lib/use-locale";
import type { User } from "@/app/lib/api";
import { ProjectProgressCard } from "@/components/tasks/project-progress-card";
import type { ExecutionProject, ExecutionTask } from "@/components/tasks/task-types";

export function ProjectsExecutionGrid({
  projects,
  tasksByProject,
  allTasksByProject,
  generalTasks,
  allGeneralTasks,
  searchActive,
  user,
  onProjectClick,
  onTaskToggle,
  onTaskOpen,
  onTaskBlocked,
}: {
  projects: ExecutionProject[];
  tasksByProject: Map<string, ExecutionTask[]>;
  allTasksByProject: Map<string, ExecutionTask[]>;
  generalTasks: ExecutionTask[];
  allGeneralTasks: ExecutionTask[];
  searchActive?: boolean;
  user: User | null;
  onProjectClick: (project: ExecutionProject) => void;
  onTaskToggle: (task: ExecutionTask, nextDone: boolean) => void;
  onTaskOpen: (task: ExecutionTask) => void;
  onTaskBlocked: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {projects.map((project) => (
        <ProjectProgressCard
          key={project.id}
          project={project}
          tasks={tasksByProject.get(project.id) ?? []}
          allTasks={allTasksByProject.get(project.id) ?? []}
          searchActive={searchActive}
          user={user}
          onProjectClick={() => onProjectClick(project)}
          onTaskToggle={onTaskToggle}
          onTaskOpen={onTaskOpen}
          onTaskBlocked={onTaskBlocked}
        />
      ))}
      {(generalTasks.length > 0 || allGeneralTasks.length > 0) && (
        <ProjectProgressCard
          project={{
            id: "__general__",
            name: t("tasksGeneralCard"),
            description: t("tasksGeneralCardHint"),
            status: "active",
          }}
          tasks={generalTasks}
          allTasks={allGeneralTasks}
          searchActive={searchActive}
          user={user}
          onTaskToggle={onTaskToggle}
          onTaskOpen={onTaskOpen}
          onTaskBlocked={onTaskBlocked}
        />
      )}
    </div>
  );
}
