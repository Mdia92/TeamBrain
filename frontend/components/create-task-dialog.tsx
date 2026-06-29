"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useToast } from "@/components/ui/toast";

type Project = { id: string; name: string };

export function CreateTaskDialog({
  open,
  onClose,
  onCreated,
  defaultStatus = "todo",
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultStatus?: string;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [linkProject, setLinkProject] = useState<"no" | "yes">("no");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiClient
      .get<{ items: Project[] }>("/api/projects")
      .then((r) => setProjects(r.items))
      .catch(() => setProjects([]));
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await apiClient.post("/api/tasks", {
        title: title.trim(),
        status: defaultStatus,
        project_id: linkProject === "yes" && projectId ? projectId : null,
      });
      toast("Tâche créée", "success");
      setTitle("");
      setLinkProject("no");
      setProjectId("");
      onCreated?.();
      onClose();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="tb-card w-full max-w-md space-y-4 p-6 shadow-dropdown">
        <h2 className="text-lg font-semibold">Nouvelle tâche</h2>
        <div>
          <label className="tb-label" htmlFor="task-title">Titre *</label>
          <input
            id="task-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="tb-input"
            placeholder="Ex. Préparer le rapport mensuel"
            autoFocus
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="tb-label">Lier à un projet ?</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="link-project"
              checked={linkProject === "no"}
              onChange={() => setLinkProject("no")}
            />
            Non — tâche générale de l&apos;organisation
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="link-project"
              checked={linkProject === "yes"}
              onChange={() => setLinkProject("yes")}
            />
            Oui — choisir un projet existant
          </label>
        </fieldset>
        {linkProject === "yes" && (
          <div>
            <label className="tb-label" htmlFor="task-project">Projet</label>
            <select
              id="task-project"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="tb-input"
            >
              <option value="">Sélectionner…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">Aucun projet — créez-en un dans Projets.</p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="tb-btn-secondary h-10 px-4">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="tb-btn-primary h-10 px-4">
            {loading ? "Création…" : "Créer la tâche"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function CreateTaskButton({
  onCreated,
  className,
}: {
  onCreated?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "tb-btn-primary h-10"}>
        <Plus className="h-4 w-4" />
        Nouvelle tâche
      </button>
      <CreateTaskDialog open={open} onClose={() => setOpen(false)} onCreated={onCreated} />
    </>
  );
}
