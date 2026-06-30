"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useToast } from "@/components/ui/toast";

type Member = { id: string; full_name: string; email: string; role: string };

export function MemberAssignSelect({
  value,
  onChange,
  allowNone = true,
  id = "assignee",
}: {
  value: string;
  onChange: (id: string) => void;
  allowNone?: boolean;
  id?: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    apiClient
      .get<{ items: Member[] }>("/api/members/roster")
      .then((r) => setMembers(r.items))
      .catch(() => setMembers([]));
  }, []);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="tb-input"
    >
      {allowNone && <option value="">Non assigné</option>}
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.full_name} ({m.role})
        </option>
      ))}
    </select>
  );
}

export function TaskAssigneeEditor({
  taskId,
  assigneeId,
  assigneeName,
  onUpdated,
}: {
  taskId: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  onUpdated?: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(assigneeId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(assigneeId ?? "");
  }, [assigneeId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await apiClient.patch<{ assignee_name?: string }>(`/api/tasks/${taskId}/assign`, {
        assignee_id: value || null,
      });
      toast(
        r.assignee_name ? `Assigné à ${r.assignee_name}` : "Assignation retirée",
        "success",
      );
      onUpdated?.();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="tb-label" htmlFor={`assign-${taskId}`}>
        Assigner à
      </label>
      {assigneeName && !value && (
        <p className="text-xs text-slate-500">Actuel : {assigneeName}</p>
      )}
      <MemberAssignSelect id={`assign-${taskId}`} value={value} onChange={setValue} />
      <button type="submit" disabled={saving} className="tb-btn-secondary h-9 px-3 text-sm">
        {saving ? "…" : "Enregistrer l'assignation"}
      </button>
    </form>
  );
}
