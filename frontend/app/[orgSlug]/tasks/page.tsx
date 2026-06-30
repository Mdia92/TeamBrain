"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckSquare, FolderKanban } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  canCompleteTask,
  canCreateContent,
  canEditContent,
  isReadOnly,
  memberApprovalHint,
} from "@/app/lib/permissions";
import { useTranslation } from "@/app/lib/use-locale";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { CreateTaskButton } from "@/components/create-task-dialog";
import { TaskAssigneeEditor } from "@/components/task-assignee";
import { useOrgRefresh } from "@/app/contexts/OrgSyncContext";
import { TasksPageHeader } from "@/components/tasks/tasks-page-header";
import { ProjectsExecutionGrid } from "@/components/tasks/projects-execution-grid";
import {
  matchesStatusFilter,
  type ExecutionProject,
  type ExecutionTask,
  type StatusFilter,
} from "@/components/tasks/task-types";

export default function TasksPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ExecutionTask[]>([]);
  const [projects, setProjects] = useState<ExecutionProject[]>([]);
  const [selectedTask, setSelectedTask] = useState<ExecutionTask | null>(null);
  const [selectedProject, setSelectedProject] = useState<ExecutionProject | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const readOnly = isReadOnly(user);
  const canAdd = canCreateContent(user);
  const canDelete = canEditContent(user);
  const isAdmin = canEditContent(user);

  const load = useCallback(async () => {
    try {
      const [taskRes, projectRes] = await Promise.all([
        apiClient.get<{ items: ExecutionTask[] }>("/api/tasks"),
        apiClient.get<{ items: ExecutionProject[] }>("/api/projects"),
      ]);
      setTasks(taskRes.items);
      setProjects(projectRes.items.filter((p) => p.status !== "completed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useOrgRefresh(() => void load());

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!matchesStatusFilter(task.status, statusFilter)) return false;
      if (!q) return true;
      const hay = `${task.title} ${task.assignee_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, search, statusFilter]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, ExecutionTask[]>();
    for (const task of filteredTasks) {
      if (!task.project_id) continue;
      const list = map.get(task.project_id) ?? [];
      list.push(task);
      map.set(task.project_id, list);
    }
    return map;
  }, [filteredTasks]);

  const allTasksByProject = useMemo(() => {
    const map = new Map<string, ExecutionTask[]>();
    for (const task of tasks) {
      if (!task.project_id) continue;
      const list = map.get(task.project_id) ?? [];
      list.push(task);
      map.set(task.project_id, list);
    }
    return map;
  }, [tasks]);

  const generalTasks = useMemo(
    () => filteredTasks.filter((t) => !t.project_id),
    [filteredTasks],
  );

  const allGeneralTasks = useMemo(() => tasks.filter((t) => !t.project_id), [tasks]);

  const hasFilters = search.trim() !== "" || statusFilter !== "all";

  const nothingAtAll = projects.length === 0 && tasks.length === 0;
  const showGrid = projects.length > 0 || tasks.length > 0;

  async function handleTaskToggle(task: ExecutionTask, nextDone: boolean) {
    if (readOnly) {
      toast("Votre essai est terminé — mode lecture seule.", "error");
      return;
    }
    if (!isAdmin && (!canCompleteTask(user, task) || !nextDone)) {
      toast(memberApprovalHint(), "info");
      return;
    }
    const newStatus = nextDone ? "done" : "todo";
    const prevStatus = task.status;
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: newStatus } : item)));
    setSelectedTask((prev) => (prev?.id === task.id ? { ...prev, status: newStatus } : prev));
    try {
      await apiClient.patch(`/api/tasks/${task.id}/status`, { status: newStatus });
      toast(nextDone ? "Tâche terminée" : "Tâche mise à jour", "success");
    } catch (err) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: prevStatus } : item)));
      setSelectedTask((prev) => (prev?.id === task.id ? { ...prev, status: prevStatus } : prev));
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    }
  }

  async function handleCompleteTask(task: ExecutionTask) {
    await handleTaskToggle(task, true);
  }

  function handleTaskBlocked() {
    toast(memberApprovalHint(), "info");
  }

  if (loading) return <CardSkeleton lines={6} />;

  return (
    <div className="mx-auto w-full max-w-7xl animate-in space-y-6 fade-in slide-in-from-bottom-3 duration-300">
      {showGrid && (
        <TasksPageHeader
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAddTask={canAdd ? () => setCreateOpen(true) : undefined}
        />
      )}

      {canAdd && (
        <CreateTaskButton
          hideTrigger
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => void load()}
        />
      )}

      {!isAdmin && showGrid && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {t("tasksMemberHint")}
        </p>
      )}

      {nothingAtAll ? (
        <EmptyState
          icon={CheckSquare}
          title={t("tasksEmpty")}
          description={t("tasksNoProjectsOpen")}
          action={
            canAdd ? (
              <Link href={`/${orgSlug}/projects`} className="tb-btn-primary inline-flex h-10">
                <FolderKanban className="h-4 w-4" />
                Créer un projet →
              </Link>
            ) : undefined
          }
        />
      ) : showGrid ? (
        <ProjectsExecutionGrid
          projects={projects}
          tasksByProject={tasksByProject}
          allTasksByProject={allTasksByProject}
          generalTasks={generalTasks}
          allGeneralTasks={allGeneralTasks}
          searchActive={hasFilters}
          user={user}
          onProjectClick={setSelectedProject}
          onTaskToggle={(task, nextDone) => void handleTaskToggle(task, nextDone)}
          onTaskOpen={setSelectedTask}
          onTaskBlocked={handleTaskBlocked}
        />
      ) : (
        <EmptyState
          icon={CheckSquare}
          title={t("tasksEmpty")}
          description={t("tasksEmptyHint")}
          action={canAdd ? <CreateTaskButton onCreated={() => void load()} /> : undefined}
        />
      )}

      <DetailDrawer
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title ?? "Tâche"}
      >
        {selectedTask && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-slate-500">Statut :</span>{" "}
              <span className="capitalize">{selectedTask.status.replace("_", " ")}</span>
            </p>
            {selectedTask.assignee_name && (
              <p>
                <span className="text-slate-500">Assigné à :</span> {selectedTask.assignee_name}
              </p>
            )}
            {canDelete && (
              <TaskAssigneeEditor
                taskId={selectedTask.id}
                assigneeId={selectedTask.assignee_id}
                assigneeName={selectedTask.assignee_name}
                onUpdated={() => void load()}
              />
            )}
            {selectedTask.due_date && (
              <p>
                <span className="text-slate-500">Échéance :</span> {selectedTask.due_date}
              </p>
            )}
            {selectedTask.source && (
              <p>
                <span className="text-slate-500">Source :</span> {selectedTask.source}
              </p>
            )}
            {!isAdmin && canCompleteTask(user, selectedTask) && (
              <button
                type="button"
                onClick={() => void handleCompleteTask(selectedTask)}
                className="tb-btn-primary w-full"
              >
                Marquer terminé
              </button>
            )}
            {!isAdmin && !canCompleteTask(user, selectedTask) && (
              <p className="text-xs text-amber-700 dark:text-amber-400">{memberApprovalHint()}</p>
            )}
            {canDelete && (
              <DeleteResourceButton
                path={`/api/tasks/${selectedTask.id}`}
                label={selectedTask.title}
                onDeleted={() => {
                  setSelectedTask(null);
                  void load();
                }}
              />
            )}
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
        title={selectedProject?.name ?? ""}
      >
        {selectedProject && (
          <div className="space-y-4 text-sm">
            {selectedProject.client_name && (
              <p>
                <span className="text-slate-500">Client :</span> {selectedProject.client_name}
              </p>
            )}
            {selectedProject.description && (
              <p className="leading-relaxed">{selectedProject.description}</p>
            )}
            <p>
              <span className="text-slate-500">Statut :</span>{" "}
              <span className="font-medium capitalize">{selectedProject.status}</span>
            </p>
            <Link href={`/${orgSlug}/projects/${selectedProject.id}`} className="tb-btn-primary inline-flex h-10">
              Ouvrir le projet →
            </Link>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
