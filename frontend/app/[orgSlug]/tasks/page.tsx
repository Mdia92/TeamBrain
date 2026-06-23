"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KanbanBoard, type KanbanTask } from "@/components/kanban-board";
import { CardSkeleton } from "@/components/ui/skeleton";

export default function TasksPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const readOnly = user?.billing?.is_read_only === true;

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
    try {
      await apiClient.patch(`/api/tasks/${taskId}/status`, { status });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
      toast("Tâche mise à jour", "success");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    }
  }

  if (loading) return <CardSkeleton lines={6} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("tasks")} description="Glissez-déposez les tâches entre les colonnes." />
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
        />
      )}
    </div>
  );
}
