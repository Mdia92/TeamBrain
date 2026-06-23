"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/app/lib/i18n";

type Channel = { id: string; name: string; project_id: string | null };
type Message = { id: string; content: string; sender_name: string; created_at: string; is_pinned: boolean };

export default function MessagesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<{ items: Channel[] }>("/api/messages/channels").then((r) => {
      setChannels(r.items);
      if (r.items[0]) setActiveChannel(r.items[0].id);
    });
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    const loadMessages = () =>
      apiClient.get<{ items: Message[] }>(`/api/messages/channels/${activeChannel}`).then((r) => setMessages(r.items));
    void loadMessages();
    const interval = setInterval(() => void loadMessages(), 5000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeChannel) return;
    const fd = new FormData(e.currentTarget);
    const content = String(fd.get("content"));
    if (!content.trim()) return;
    await apiClient.post("/api/messages", { channel_id: activeChannel, content });
    e.currentTarget.reset();
    const r = await apiClient.get<{ items: Message[] }>(`/api/messages/channels/${activeChannel}`);
    setMessages(r.items);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("messages")} description="Communiquez avec votre équipe par canaux." />
      <div className="flex h-[calc(100vh-12rem)] gap-4">
      <div className="w-52 shrink-0 space-y-1 overflow-y-auto rounded-card border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">Canaux</h2>
        {channels.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveChannel(c.id)}
            className={`block w-full rounded-input px-2 py-2 text-left text-sm transition-colors ${
              activeChannel === c.id
                ? "bg-primary/10 font-medium text-primary"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            #{c.name}
          </button>
        ))}
      </div>
      <div className="tb-card flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-medium text-amber-800 dark:text-amber-400">{m.sender_name}</span>
              <span className="ml-2 text-xs text-stone-400">{new Date(m.created_at).toLocaleString("fr")}</span>
              <p className="mt-0.5">{m.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
          <input name="content" placeholder="Écrire un message..." className="tb-input flex-1" />
          <button type="submit" className="tb-btn-primary h-9">Envoyer</button>
        </form>
      </div>
      </div>
    </div>
  );
}
