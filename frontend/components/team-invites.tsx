"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, Trash2 } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canManageOrg } from "@/app/lib/permissions";
import { useToast } from "@/components/ui/toast";

type Invite = {
  id: string;
  email: string;
  role: string;
  short_code?: string;
  status?: string;
  expires_at?: string;
};

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Membre" },
  { value: "field_agent", label: "Agent terrain" },
];

export function TeamInvitesSection() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [lastDelivery, setLastDelivery] = useState<{
    email: string;
    full_invite_url?: string;
    short_code?: string;
    email_sent?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      const created = await apiClient.post<{
        email: string;
        short_code: string;
        full_invite_url?: string;
        email_sent?: boolean;
        invite_url: string;
      }>("/api/invites", { email, role });
      const full =
        created.full_invite_url ??
        (typeof window !== "undefined" ? `${window.location.origin}${created.invite_url}` : created.invite_url);
      setLastDelivery({
        email: created.email,
        full_invite_url: full,
        short_code: created.short_code,
        email_sent: created.email_sent,
      });
      setEmail("");
      await loadInvites();
      await refreshUser();
      toast(
        created.email_sent
          ? `Invitation envoyée à ${created.email}`
          : `Invitation créée — copiez le lien (email non configuré)`,
        created.email_sent ? "success" : "info",
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Erreur lors de l'invitation");
    } finally {
      setLoading(false);
    }
  }

  async function revokeInvite(id: string) {
    if (!window.confirm("Annuler cette invitation ?")) return;
    setBusyId(id);
    try {
      await apiClient.delete(`/api/invites/${id}`);
      await loadInvites();
      toast("Invitation annulée", "success");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvite(id: string) {
    setBusyId(id);
    try {
      const r = await apiClient.post<{
        email_sent?: boolean;
        full_invite_url?: string;
        short_code?: string;
      }>(`/api/invites/${id}/resend`, {});
      toast(r.email_sent ? "Invitation renvoyée par email" : "Lien régénéré — copiez depuis la liste", r.email_sent ? "success" : "info");
      if (r.full_invite_url) {
        setLastDelivery({
          email: "",
          full_invite_url: r.full_invite_url,
          short_code: r.short_code,
          email_sent: r.email_sent,
        });
      }
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    } finally {
      setBusyId(null);
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
      <p className="text-sm text-slate-500">
        Les personnes invitées restent <strong>en attente</strong> jusqu&apos;à ce qu&apos;elles acceptent via le lien ou le code.
        Elles n&apos;apparaissent pas comme membres actifs avant confirmation.
      </p>
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
      {lastDelivery && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {lastDelivery.email_sent ? "Invitation envoyée" : "Invitation créée (copiez manuellement)"}
          </p>
          {lastDelivery.email && <p className="mt-1 text-slate-600">À : {lastDelivery.email}</p>}
          {lastDelivery.short_code && (
            <p className="mt-2">
              Code : <code className="rounded bg-white px-2 py-0.5 font-mono text-xs dark:bg-stone-900">{lastDelivery.short_code}</code>
              {" "}(page <code className="text-xs">/join</code>)
            </p>
          )}
          {lastDelivery.full_invite_url && (
            <>
              <p className="mt-2 font-medium">Lien direct :</p>
              <code className="mt-1 block break-all text-xs">{lastDelivery.full_invite_url}</code>
            </>
          )}
        </div>
      )}
      {invites.length > 0 && (
        <ul className="space-y-2 text-sm">
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 dark:border-stone-700">
              <div className="min-w-0">
                <p className="font-medium">{inv.email}</p>
                <p className="text-xs text-slate-500">
                  {inv.role}
                  {inv.short_code ? ` · ${inv.short_code}` : ""}
                  {" · "}
                  <span className="text-amber-700 dark:text-amber-400">En attente</span>
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => void resendInvite(inv.id)}
                  className="rounded border px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Renvoyer l'email"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => void revokeInvite(inv.id)}
                  className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                  title="Annuler l'invitation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
