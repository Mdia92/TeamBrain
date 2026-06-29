"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  canCompleteTask,
  canCreateContent,
  canDragTasks,
  canEditContent,
  isReadOnly,
  memberApprovalHint,
} from "@/app/lib/permissions";
import { useTranslation } from "@/app/lib/use-locale";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TaskBoard, type BoardTask } from "@/components/task-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DeleteResourceButton } from "@/components/delete-resource-button";

export default function TasksPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [selected, setSelected] = useState<BoardTask | null>(null);
  const [loading, setLoading] = useState(true);
  const readOnly = isReadOnly(user);
  const canDrag = canDragTasks(user);
  const canAdd = canCreateContent(user);
  const canDelete = canEditContent(user);

  const load = () =>
    apiClient
      .get<{ items: BoardTask[] }>("/api/tasks")
      .then((r) => setTasks(r.items))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  async function handleStatusChange(taskId: string, status: string) {
    if (readOnly) {
      toast("Votre essai est terminé — mode lecture seule.", "error");
      return;
    }
    if (!canDrag) {
      toast(memberApprovalHint(), "info");
      return;
    }
    try {
      await apiClient.patch(`/api/tasks/${taskId}/status`, { status });
      setTasks((prev) => prev.map((item) => (item.id === taskId ? { ...item, status } : item)));
      toast("Tâche mise à jour", "success");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    }
  }

  async function handleCompleteTask(task: BoardTask) {
    if (readOnly) {
      toast("Votre essai est terminé — mode lecture seule.", "error");
      return;
    }
    if (!canCompleteTask(user, task)) {
      toast(memberApprovalHint(), "info");
      return;
    }
    try {
      await apiClient.patch(`/api/tasks/${task.id}/status`, { status: "done" });
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: "done" } : item)));
      setSelected((prev) => (prev?.id === task.id ? { ...prev, status: "done" } : prev));
      toast("Tâche terminée", "success");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    }
  }

  if (loading) return <CardSkeleton lines={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tasks")}
        description={canDrag ? t("taskBoardDragHint") : t("taskBoardViewHint")}
      />
      {!canDrag && (
        <p className="rounded-input border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {memberApprovalHint()} pour modifier le statut d&apos;une tâche.
        </p>
      )}
      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t("tasksEmpty")}
          description={t("tasksEmptyHint")}
        />
      ) : (
        <TaskBoard
          tasks={tasks}
          orgSlug={orgSlug}
          onStatusChange={handleStatusChange}
          onTaskCreated={() => void load()}
          canDrag={canDrag}
          canQuickAdd={canAdd}
          onTaskClick={setSelected}
        />
      )}

      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? "Tâche"}>
        {selected && (
          <div className="space-y-3 text-sm">
            <p><span className="text-slate-500">Statut :</span> <span className="capitalize">{selected.status.replace("_", " ")}</span></p>
            {selected.assignee_name && <p><span className="text-slate-500">Assigné à :</span> {selected.assignee_name}</p>}
            {selected.due_date && <p><span className="text-slate-500">Échéance :</span> {selected.due_date}</p>}
            {selected.source && <p><span className="text-slate-500">Source :</span> {selected.source}</p>}
            {!canDrag && canCompleteTask(user, selected) && (
              <button
                type="button"
                onClick={() => void handleCompleteTask(selected)}
                className="tb-btn-primary w-full"
              >
                Marquer terminé
              </button>
            )}
            {!canDrag && !canCompleteTask(user, selected) && (
              <p className="text-xs text-amber-700 dark:text-amber-400">{memberApprovalHint()}</p>
            )}
            {canDelete && (
              <DeleteResourceButton
                path={`/api/tasks/${selected.id}`}
                label={selected.title}
                onDeleted={() => {
                  setSelected(null);
                  void load();
                }}
              />
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
