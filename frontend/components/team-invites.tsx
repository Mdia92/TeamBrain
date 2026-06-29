"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canManageOrg } from "@/app/lib/permissions";

type Invite = { id: string; email: string; role: string; short_code?: string; token?: string; invite_url?: string };

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Membre" },
  { value: "field_agent", label: "Agent terrain" },
];

export function TeamInvitesSection() {
  const { user, refreshUser } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [lastLink, setLastLink] = useState("");
  const [lastCode, setLastCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canInvite = canManageOrg(user);

  const loadInvites = useCallback(async () => {
    if (!canInvite) return;
    try {
      const data = await apiClient.get<{ items: Invite[] }>("/api/invites");
      setInvites(data.items);
    } catch {
      /* ignore */
    }
  }, [canInvite]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Email invalide");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const created = await apiClient.post<Invite>("/api/invites", { email, role });
      const path = created.invite_url ?? `/invite/${created.token}`;
      const full = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
      setLastLink(full);
      setLastCode(created.short_code ?? "");
      setEmail("");
      await loadInvites();
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Erreur lors de l'invitation");
    } finally {
      setLoading(false);
    }
  }

  if (!canInvite) {
    return (
      <p className="text-sm text-stone-500">
        Seuls les administrateurs peuvent inviter des membres.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          placeholder="email@exemple.sn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border px-2 py-2 dark:border-stone-700 dark:bg-stone-800"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "..." : "Inviter"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lastLink && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium">Invitation créée</p>
          {lastCode && (
            <p className="mt-2">
              Code : <code className="rounded bg-white px-2 py-0.5 font-mono text-xs dark:bg-stone-900">{lastCode}</code>
              {" "}(saisir sur <code className="text-xs">/join</code>)
            </p>
          )}
          <p className="mt-2 font-medium">Lien :</p>
          <code className="mt-1 block break-all text-xs">{lastLink}</code>
        </div>
      )}
      {invites.length > 0 && (
        <ul className="space-y-2 text-sm">
          {invites.map((inv) => (
            <li key={inv.id} className="flex justify-between gap-2 rounded border px-3 py-2 dark:border-stone-700">
              <span>{inv.email}</span>
              <span className="text-stone-500">
                {inv.role}
                {inv.short_code ? ` · ${inv.short_code}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
