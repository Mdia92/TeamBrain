"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { apiClient } from "@/app/lib/api";

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
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-48 shrink-0 space-y-1 overflow-y-auto">
        <h2 className="px-2 text-sm font-semibold text-stone-500">Canaux</h2>
        {channels.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveChannel(c.id)}
            className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${
              activeChannel === c.id ? "bg-amber-100 dark:bg-amber-950" : "hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            #{c.name}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
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
        <form onSubmit={handleSend} className="flex gap-2 border-t border-stone-200 p-3 dark:border-stone-800">
          <input name="content" placeholder="Écrire un message..." className="flex-1 rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <button type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white">Envoyer</button>
        </form>
      </div>
    </div>
  );
}
