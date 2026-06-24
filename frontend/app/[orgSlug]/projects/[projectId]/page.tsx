"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Link2, Plus } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canEditContent, isManagerOrAbove } from "@/app/lib/permissions";
import { cn } from "@/app/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ProjectTimeline } from "@/components/project/project-timeline";

type Project = {
  id: string;
  name: string;
  client_name?: string;
  description?: string;
  status: string;
};

type TaskOption = { id: string; title: string };

const TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "timeline", label: "Chronologie" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ProjectDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = String(params.orgSlug);
  const projectId = String(params.projectId);
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = canEditContent(user);
  const isManager = isManagerOrAbove(user);

  const initialTab = searchParams.get("tab") === "timeline" ? "timeline" : "overview";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [project, setProject] = useState<Project | null>(null);
  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([]);
  const [depTaskId, setDepTaskId] = useState("");
  const [depOnId, setDepOnId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    const [p, tasks] = await Promise.all([
      apiClient.get<Project>(`/api/projects/${projectId}`),
      apiClient.get<{ items: TaskOption[] }>(`/api/tasks?project_id=${projectId}&limit=100`),
    ]);
    setProject(p);
    setTaskOptions(tasks.items.map((t) => ({ id: t.id, title: t.title })));
  }, [projectId]);

  useEffect(() => {
    loadProject()
      .catch(() => toast("Projet introuvable", "error"))
      .finally(() => setLoading(false));
  }, [loadProject, toast]);

  async function addDependency(e: FormEvent) {
    e.preventDefault();
    if (!depTaskId || !depOnId) return;
    try {
      await apiClient.post(`/api/tasks/${depTaskId}/dependencies`, {
        depends_on_task_id: depOnId,
      });
      toast("Dépendance ajoutée", "success");
      setDepOnId("");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-sm text-slate-500">Projet introuvable.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/${orgSlug}/projects`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Projets
      </Link>

      <PageHeader title={project.name} description={project.client_name ?? undefined} />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="tb-card space-y-4 p-6 text-sm">
          {project.description && <p className="leading-relaxed">{project.description}</p>}
          <p>
            <span className="text-slate-500">Statut :</span>{" "}
            <span className="font-medium capitalize">{project.status}</span>
          </p>
          <Link href={`/${orgSlug}/tasks?project=${projectId}`} className="tb-btn-primary inline-flex h-10">
            Voir le kanban →
          </Link>
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-6">
          <ProjectTimeline projectId={projectId} canEdit={canEdit} />

          {isManager && taskOptions.length >= 2 && (
            <form onSubmit={addDependency} className="tb-card space-y-3 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4" />
                Ajouter une dépendance
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="tb-label">Tâche</label>
                  <select
                    value={depTaskId}
                    onChange={(e) => setDepTaskId(e.target.value)}
                    className="tb-input"
                    required
                  >
                    <option value="">Choisir…</option>
                    {taskOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="tb-label">Dépend de</label>
                  <select
                    value={depOnId}
                    onChange={(e) => setDepOnId(e.target.value)}
                    className="tb-input"
                    required
                  >
                    <option value="">Choisir…</option>
                    {taskOptions
                      .filter((t) => t.id !== depTaskId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="tb-btn-secondary h-9 gap-1 text-sm">
                <Plus className="h-4 w-4" />
                Lier les tâches
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ProjectDetailContent />
    </Suspense>
  );
}
