"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";

type Project = {
  id: string;
  name: string;
  client_name: string;
  status: string;
  description: string;
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const readOnly = user?.billing?.is_read_only === true;

  const load = () => apiClient.get<{ items: Project[] }>("/api/projects").then((r) => setProjects(r.items));
  useEffect(() => { void load(); }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setFormError("Le nom du projet est obligatoire");
      return;
    }
    if (readOnly) {
      setFormError("Votre essai est terminé — mode lecture seule.");
      return;
    }
    setFormError("");
    const fd = new FormData(e.currentTarget);
    try {
      await apiClient.post("/api/projects", {
        name,
        client_name: fd.get("client_name"),
        description: fd.get("description"),
      });
      setShowForm(false);
      void load();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Erreur lors de la création");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("projects")}</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={readOnly}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {t("newProject")}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3 dark:border-stone-800 dark:bg-stone-900">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <input name="name" placeholder="Nom du projet" required className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <input name="client_name" placeholder="Client" className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <textarea name="description" placeholder="Description" className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white">{t("save")}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-stone-500">{t("cancel")}</button>
          </div>
        </form>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <h3 className="font-semibold">{p.name}</h3>
            {p.client_name && <p className="text-sm text-stone-500">{p.client_name}</p>}
            <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-300">
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
