"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";

type MetaOption = { id: string; label: string };

type AutomationRule = {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  is_active: boolean;
};

const DEFAULT_ACTION_CONFIG: Record<string, Record<string, string>> = {
  send_notification: {
    title: "Notification TeamBrain",
    body: "{{title}}",
    target: "assignee",
  },
  send_whatsapp: {
    message: "Rappel TeamBrain : {{title}}",
    recipient: "assignee",
  },
  notify_admin: {
    title: "Alerte administrateur",
    body: "Événement : {{title}}",
  },
  create_pending_action: {
    pending_action_type: "create_task",
    payload: '{"title": "Suivi : {{title}}"}',
  },
  add_memory: {
    note: "Automatisation : {{title}}",
    memory_type: "episodic",
  },
};

export function AutomationBuilder() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [triggers, setTriggers] = useState<MetaOption[]>([]);
  const [actions, setActions] = useState<MetaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("task_created");
  const [actionType, setActionType] = useState("notify_admin");
  const [actionBody, setActionBody] = useState(DEFAULT_ACTION_CONFIG.notify_admin.body);

  useEffect(() => {
    Promise.all([
      apiClient.get<{ triggers: MetaOption[]; actions: MetaOption[] }>("/api/automations/meta"),
      apiClient.get<{ items: AutomationRule[] }>("/api/automations"),
    ])
      .then(([meta, list]) => {
        setTriggers(meta.triggers);
        setActions(meta.actions);
        setRules(list.items);
        if (meta.triggers[0]) setTriggerType(meta.triggers[0].id);
        if (meta.actions[0]) setActionType(meta.actions[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const defaults = DEFAULT_ACTION_CONFIG[actionType];
    if (defaults?.body) setActionBody(defaults.body);
    else if (defaults?.message) setActionBody(defaults.message);
    else if (defaults?.note) setActionBody(defaults.note);
  }, [actionType]);

  async function toggleActive(rule: AutomationRule) {
    try {
      const updated = await apiClient.patch<AutomationRule>(`/api/automations/${rule.id}`, {
        is_active: !rule.is_active,
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Erreur");
    }
  }

  async function deleteRule(id: string) {
    try {
      await apiClient.delete(`/api/automations/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Erreur");
    }
  }

  async function createRule(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const action_config: Record<string, unknown> = { ...DEFAULT_ACTION_CONFIG[actionType] };
    if (actionType === "send_notification" || actionType === "notify_admin") {
      action_config.body = actionBody;
      if (actionType === "send_notification") action_config.title = action_config.title ?? "Notification";
    } else if (actionType === "send_whatsapp") {
      action_config.message = actionBody;
    } else if (actionType === "add_memory") {
      action_config.note = actionBody;
    } else if (actionType === "create_pending_action") {
      try {
        action_config.payload = JSON.parse(String(action_config.payload));
      } catch {
        action_config.payload = { title: actionBody };
      }
    }
    try {
      const created = await apiClient.post<AutomationRule>("/api/automations", {
        name: name || `Règle ${triggerType}`,
        trigger_type: triggerType,
        trigger_config: {},
        action_type: actionType,
        action_config,
        is_active: true,
      });
      setRules((prev) => [created, ...prev]);
      setName("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Erreur de création");
    } finally {
      setSaving(false);
    }
  }

  function labelFor(options: MetaOption[], id: string) {
    return options.find((o) => o.id === id)?.label ?? id;
  }

  if (loading) return <p className="text-sm text-slate-500">Chargement…</p>;

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        Créez des règles sans code. Les actions qui modifient des données passent par l&apos;approbation
        administrateur ; les notifications sont envoyées immédiatement.
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <form onSubmit={createRule} className="tb-card space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Zap className="h-4 w-4 text-primary" />
          Nouvelle règle
        </h3>
        <div>
          <label className="tb-label">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tb-input"
            placeholder="Ex. Rappel tâche en retard"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="tb-label">Quand</label>
            <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="tb-input">
              {triggers.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="tb-label">Alors</label>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="tb-input">
              {actions.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="tb-label">Message (variables : {"{{title}}"}, {"{{task_id}}"}…)</label>
          <textarea
            value={actionBody}
            onChange={(e) => setActionBody(e.target.value)}
            rows={2}
            className="tb-input min-h-[60px] py-2"
          />
        </div>
        <button type="submit" disabled={saving} className="tb-btn-primary h-10 gap-1">
          <Plus className="h-4 w-4" />
          {saving ? "Création…" : "Ajouter la règle"}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold">Règles actives ({rules.filter((r) => r.is_active).length})</h3>
        {rules.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune règle pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-input border px-4 py-3",
                  rule.is_active
                    ? "border-slate-200 dark:border-slate-700"
                    : "border-slate-100 opacity-60 dark:border-slate-800",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-xs text-slate-500">
                    Quand <span className="text-slate-700 dark:text-slate-300">{labelFor(triggers, rule.trigger_type)}</span>
                    {" → "}
                    <span className="text-slate-700 dark:text-slate-300">{labelFor(actions, rule.action_type)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(rule)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      rule.is_active ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
                    )}
                    aria-pressed={rule.is_active}
                    title={rule.is_active ? "Désactiver" : "Activer"}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        rule.is_active ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRule(rule.id)}
                    className="rounded-input p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
