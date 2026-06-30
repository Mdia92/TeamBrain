"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canCreateProject, canEditContent, isReadOnly, memberApprovalHint } from "@/app/lib/permissions";
import { useTranslation } from "@/app/lib/use-locale";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { TbCard } from "@/components/ui/tb-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { useGsapStagger } from "@/hooks/use-gsap-stagger";
import { useOrgRefresh, useOrgSync } from "@/app/contexts/OrgSyncContext";

type Project = {
  id: string;
  name: string;
  client_name: string;
  status: string;
  description: string;
};

export default function ProjectsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { bumpLocal } = useOrgSync();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const gridRef = useGsapStagger<HTMLDivElement>([projects.length]);
  const readOnly = isReadOnly(user);
  const canCreate = canCreateProject(user);
  const canEdit = canEditContent(user);

  const load = useCallback(
    () =>
      apiClient
        .get<{ items: Project[] }>("/api/projects")
        .then((r) => setProjects(r.items))
        .finally(() => setLoading(false)),
    [],
  );

  useOrgRefresh(() => void load());

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate) {
      setFormError(readOnly ? "Votre essai est terminé — mode lecture seule." : memberApprovalHint());
      return;
    }
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setFormError("Le nom du projet est obligatoire");
      return;
    }
    setFormError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiClient.post("/api/projects", {
        name,
        client_name: fd.get("client_name"),
        description: fd.get("description"),
      });
      setShowForm(false);
      toast("Projet créé", "success");
      void load();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "Erreur lors de la création";
      setFormError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function markDone(project: Project) {
    if (!canEdit) {
      toast(memberApprovalHint(), "info");
      return;
    }
    try {
      await apiClient.patch(`/api/projects/${project.id}`, {
        name: project.name,
        client_name: project.client_name,
        description: project.description,
        status: "completed",
      });
      toast("Projet marqué terminé", "success");
      setSelected(null);
      void load();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    }
  }

  if (loading) return <CardSkeleton lines={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("projectsPageDesc")}</p>
        {canCreate ? (
          <button type="button" onClick={() => setShowForm(true)} className="tb-btn-primary h-10">
            <Plus className="h-4 w-4" />
            {t("newProject")}
          </button>
        ) : (
          <span className="text-xs text-slate-500">{memberApprovalHint()}</span>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="tb-card animate-slide-up space-y-4 p-6">
          {formError && <p className="text-sm text-rose-600">{formError}</p>}
          <div>
            <label className="tb-label" htmlFor="name">Nom du projet *</label>
            <input id="name" name="name" required className="tb-input" placeholder="Ex. Programme santé 2026" />
          </div>
          <div>
            <label className="tb-label" htmlFor="client_name">Client</label>
            <input id="client_name" name="client_name" className="tb-input" placeholder="Nom du client" />
          </div>
          <div>
            <label className="tb-label" htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={3} className="tb-input min-h-[80px] py-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="tb-btn-primary h-10">
              {saving ? "Enregistrement..." : t("save")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="tb-btn-secondary">{t("cancel")}</button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aucun projet encore"
          description="Créez votre premier projet pour structurer tâches, documents et rapports terrain."
          action={
            canCreate ? (
              <button type="button" onClick={() => setShowForm(true)} className="tb-btn-primary h-10">
                Créer votre premier projet →
              </button>
            ) : undefined
          }
        />
      ) : (
        <div ref={gridRef} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <TbCard
              key={p.id}
              stagger
              interactive
              className="relative block p-5"
              onClick={() => setSelected(p)}
            >
              {canEdit && (
                <button
                  type="button"
                  title="Supprimer"
                  className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!window.confirm(`${t("deleteConfirm")} « ${p.name} » ?`)) return;
                    void apiClient.delete(`/api/projects/${p.id}`).then(() => {
                      toast(t("deleted"), "success");
                      bumpLocal();
                      void load();
                    }).catch((err) => {
                      toast(err instanceof ApiRequestError ? err.message : t("deleteError"), "error");
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <h3 className="pr-8 font-semibold text-slate-900 dark:text-slate-100">{p.name}</h3>
                {p.client_name && <p className="mt-1 text-sm text-slate-500">{p.client_name}</p>}
                {p.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{p.description}</p>
                )}
                <span className="mt-3 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {p.status}
                </span>
            </TbCard>
          ))}
        </div>
      )}

      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && (
          <div className="space-y-4 text-sm">
            {selected.client_name && (
              <p><span className="text-slate-500">Client :</span> {selected.client_name}</p>
            )}
            {selected.description && <p className="leading-relaxed">{selected.description}</p>}
            <p>
              <span className="text-slate-500">Statut :</span>{" "}
              <span className="font-medium capitalize">{selected.status}</span>
            </p>
            <Link href={`/${orgSlug}/projects/${selected.id}`} className="tb-btn-primary inline-flex h-10">
              Ouvrir le projet →
            </Link>
            <Link href={`/${orgSlug}/projects/${selected.id}?tab=timeline`} className="tb-btn-secondary mt-2 inline-flex h-10 w-full justify-center">
              Chronologie →
            </Link>
            {canEdit && selected.status !== "completed" && (
              <button type="button" onClick={() => void markDone(selected)} className="tb-btn-secondary mt-2 w-full">
                Marquer comme terminé
              </button>
            )}
            {canEdit && (
              <DeleteResourceButton
                path={`/api/projects/${selected.id}`}
                label={selected.name}
                onDeleted={() => {
                  setSelected(null);
                  void load();
                }}
              />
            )}
            {!canEdit && (
              <p className="text-xs text-amber-700 dark:text-amber-400">{memberApprovalHint()}</p>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
