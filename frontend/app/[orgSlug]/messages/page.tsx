"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bold, Italic, List, Mail, Plus, X } from "lucide-react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/app/lib/utils";

type InboxItem = {
  id: string;
  subject: string;
  preview: string;
  sender_name: string;
  created_at: string;
  is_unread: boolean;
};

type ThreadMessage = {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
};

type Recipient = { id: string; full_name: string; email: string; role: string };

type Filter = "all" | "unread" | "sent";

export default function MessagesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [rootSubject, setRootSubject] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [canBroadcast, setCanBroadcast] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [sending, setSending] = useState(false);

  const [composeTo, setComposeTo] = useState<string[]>([]);
  const [broadcast, setBroadcast] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const loadInbox = useCallback(async () => {
    const r = await apiClient.get<{ items: InboxItem[] }>(`/api/messages/inbox?filter=${filter}`);
    setItems(r.items);
    if (!selectedId && r.items[0]) setSelectedId(r.items[0].id);
  }, [filter, selectedId]);

  useEffect(() => {
    void loadInbox().catch(console.error);
    const interval = setInterval(() => void loadInbox().catch(console.error), 15000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) {
      setThread([]);
      return;
    }
    apiClient
      .get<{ root: { subject: string }; messages: ThreadMessage[] }>(`/api/messages/inbox/${selectedId}`)
      .then((r) => {
        setRootSubject(r.root.subject);
        setThread(r.messages);
        void loadInbox();
      })
      .catch(console.error);
  }, [selectedId, loadInbox]);

  useEffect(() => {
    if (!composeOpen) return;
    apiClient
      .get<{ items: Recipient[]; can_broadcast: boolean }>("/api/messages/recipients")
      .then((r) => {
        setRecipients(r.items);
        setCanBroadcast(r.can_broadcast);
      })
      .catch(console.error);
  }, [composeOpen]);

  function openCompose() {
    setComposeOpen(true);
    setComposeTo([]);
    setBroadcast(false);
    setSubject("");
    setBody("");
  }

  function toggleRecipient(id: string) {
    setBroadcast(false);
    setComposeTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applyFormat(cmd: "bold" | "italic" | "list") {
    const el = document.getElementById("msg-body") as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    let wrapped = selected;
    if (cmd === "bold") wrapped = `**${selected || "texte"}**`;
    if (cmd === "italic") wrapped = `*${selected || "texte"}*`;
    if (cmd === "list") wrapped = `\n- ${selected || "élément"}`;
    const next = body.slice(0, start) + wrapped + body.slice(end);
    setBody(next);
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      await apiClient.post("/api/messages/send", {
        subject: subject.trim(),
        content: body.trim(),
        recipient_ids: broadcast ? null : composeTo,
        broadcast,
      });
      setComposeOpen(false);
      await loadInbox();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setMobileShowThread(true);
  }

  const isAdmin = user?.role === "admin" || user?.role === "owner";

  return (
    <div className="space-y-4">
      <PageHeader title="Messages" description="Boîte de réception de votre équipe." />

      <div className="flex h-[calc(100vh-11rem)] gap-0 overflow-hidden rounded-card border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Left panel */}
        <div
          className={cn(
            "flex w-full flex-col border-r border-slate-200 dark:border-slate-800 md:w-1/3",
            mobileShowThread && "hidden md:flex",
          )}
        >
          <div className="border-b border-slate-200 p-3 dark:border-slate-800">
            <button type="button" onClick={openCompose} className="tb-btn-primary mb-3 w-full gap-2">
              <Plus className="h-4 w-4" />
              Nouveau message
            </button>
            <div className="flex gap-1">
              {(["all", "unread", "sent"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-input px-2.5 py-1 text-xs font-medium",
                    filter === f
                      ? "bg-primary/10 text-primary"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
                  )}
                >
                  {f === "all" ? "Tous" : f === "unread" ? "Non lus" : "Envoyés"}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <li className="p-4 text-sm text-slate-500">Aucun message</li>
            ) : (
              items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(item.id)}
                    className={cn(
                      "flex w-full gap-3 border-b border-slate-100 p-3 text-left transition-colors dark:border-slate-800",
                      selectedId === item.id
                        ? "bg-primary/5"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      item.is_unread && "font-semibold",
                    )}
                  >
                    <Avatar name={item.sender_name} className="h-9 w-9 shrink-0 text-xs" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{item.subject}</span>
                        {item.is_unread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500">{item.preview}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleString("fr")}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Right panel */}
        <div
          className={cn(
            "flex flex-1 flex-col",
            !mobileShowThread && "hidden md:flex",
          )}
        >
          {composeOpen ? (
            <form onSubmit={handleSend} className="flex flex-1 flex-col p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Nouveau message</h2>
                <button type="button" onClick={() => setComposeOpen(false)} className="text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="tb-label">À</label>
                  {canBroadcast && (
                    <label className="mb-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={broadcast}
                        onChange={(e) => {
                          setBroadcast(e.target.checked);
                          if (e.target.checked) setComposeTo([]);
                        }}
                      />
                      Toute l&apos;équipe
                    </label>
                  )}
                  {!broadcast && (
                    <div className="flex flex-wrap gap-2">
                      {recipients
                        .filter((r) => r.id !== user?.id)
                        .map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleRecipient(r.id)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs",
                              composeTo.includes(r.id)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-slate-200 dark:border-slate-700",
                            )}
                          >
                            {r.full_name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="tb-label">Objet</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="tb-input"
                    required
                  />
                </div>
                <div>
                  <div className="mb-1 flex gap-1">
                    <button type="button" onClick={() => applyFormat("bold")} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <Bold className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => applyFormat("italic")} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <Italic className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => applyFormat("list")} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    id="msg-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="tb-input min-h-[160px] resize-y"
                    required
                  />
                </div>
              </div>
              <div className="mt-auto flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setComposeOpen(false)} className="tb-btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={sending} className="tb-btn-primary gap-2">
                  <Mail className="h-4 w-4" />
                  Envoyer
                </button>
              </div>
            </form>
          ) : selectedId && thread.length > 0 ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
                <button
                  type="button"
                  className="md:hidden"
                  onClick={() => setMobileShowThread(false)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="font-semibold">{rootSubject}</h2>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {thread.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    <Avatar name={m.sender_name} className="h-8 w-8 shrink-0 text-xs" />
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{m.sender_name}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(m.created_at).toLocaleString("fr")}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500">
              <Mail className="h-10 w-10 opacity-40" />
              <p className="text-sm">Sélectionnez une conversation ou composez un message</p>
              {!isAdmin && (
                <p className="text-xs">Les messages à toute l&apos;équipe sont réservés aux administrateurs.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
