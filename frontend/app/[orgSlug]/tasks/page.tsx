"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";
import { KanbanBoard, type KanbanTask } from "@/components/kanban-board";

export default function TasksPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [tasks, setTasks] = useState<KanbanTask[]>([]);

  const load = () =>
    apiClient.get<{ items: KanbanTask[] }>("/api/tasks").then((r) => setTasks(r.items));

  useEffect(() => { void load(); }, []);

  async function handleStatusChange(taskId: string, status: string) {
    await apiClient.patch(`/api/tasks/${taskId}/status`, { status });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("tasks")}</h1>
      <KanbanBoard tasks={tasks} orgSlug={orgSlug} onStatusChange={handleStatusChange} />
    </div>
  );
}
