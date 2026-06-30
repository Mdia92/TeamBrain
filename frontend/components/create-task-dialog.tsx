"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useTranslation } from "@/app/lib/use-locale";
import { useToast } from "@/components/ui/toast";
import { MemberAssignSelect } from "@/components/task-assignee";
import { useOrgSync } from "@/app/contexts/OrgSyncContext";

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
  const { t } = useTranslation();
  const { bumpLocal } = useOrgSync();
  const [title, setTitle] = useState("");
  const [linkProject, setLinkProject] = useState<"no" | "yes">("no");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
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
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
      });
      toast(t("taskCreated"), "success");
      bumpLocal();
      setTitle("");
      setLinkProject("no");
      setProjectId("");
      setAssigneeId("");
      setDueDate("");
      onCreated?.();
      onClose();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : t("errorGeneric"), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm duration-200">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Créer une nouvelle tâche</h2>
        </div>

        <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" htmlFor="task-title">
            {t("taskTitleLabel")} *
          </label>
          <input
            id="task-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder={t("taskTitlePlaceholder")}
            autoFocus
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Lier à un projet ?
          </legend>
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" htmlFor="task-project">
              {t("taskSelectProject")} *
            </label>
            <select
              id="task-project"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("taskSelectProject")}…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">Aucun projet — créez-en un dans Projets.</p>
            )}
          </div>
        )}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" htmlFor="task-assignee">
            {t("taskAssigneeLabel")}
          </label>
          <div className="mt-1">
            <MemberAssignSelect id="task-assignee" value={assigneeId} onChange={setAssigneeId} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" htmlFor="task-due-date">
            {t("taskDueDateLabel")}
          </label>
          <input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Création…" : t("taskAddSubmit")}
          </button>
        </div>
        </div>
      </form>
    </div>
  );
}

export function CreateTaskButton({
  onCreated,
  className,
  hideTrigger,
  open: controlledOpen,
  onOpenChange,
}: {
  onCreated?: () => void;
  className?: string;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <>
      {!hideTrigger && (
        <button type="button" onClick={() => setOpen(true)} className={className ?? "tb-btn-primary h-10"}>
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </button>
      )}
      <CreateTaskDialog open={open} onClose={() => setOpen(false)} onCreated={onCreated} />
    </>
  );
}
