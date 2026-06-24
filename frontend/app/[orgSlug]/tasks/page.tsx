"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  canCompleteTask,
  canCreateContent,
  canDragKanban,
  isReadOnly,
  memberApprovalHint,
} from "@/app/lib/permissions";
import { t } from "@/app/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KanbanBoard, type KanbanTask } from "@/components/kanban-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { DetailDrawer } from "@/components/ui/detail-drawer";

export default function TasksPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [selected, setSelected] = useState<KanbanTask | null>(null);
  const [loading, setLoading] = useState(true);
  const readOnly = isReadOnly(user);
  const canDrag = canDragKanban(user);
  const canAdd = canCreateContent(user);

  const load = () =>
    apiClient
      .get<{ items: KanbanTask[] }>("/api/tasks")
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
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
      toast("Tâche mise à jour", "success");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    }
  }

  async function handleCompleteTask(task: KanbanTask) {
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
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)));
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
        description={
          canDrag
            ? "Glissez-déposez les tâches entre les colonnes."
            : "Consultez les tâches — le déplacement est réservé aux managers."
        }
      />
      {!canDrag && (
        <p className="rounded-input border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {memberApprovalHint()} pour modifier le statut d&apos;une tâche.
        </p>
      )}
      {tasks.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aucune tâche"
          description="Créez un projet puis ajoutez des tâches depuis le tableau Kanban."
          action={
            <a href={`/${orgSlug}/projects`} className="tb-btn-primary h-10">
              Voir les projets
            </a>
          }
        />
      ) : (
        <KanbanBoard
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
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
