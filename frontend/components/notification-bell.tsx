"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  link_path?: string | null;
  read_at?: string | null;
  created_at: string;
  module: string;
};

export function NotificationBell({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<{ items: InboxItem[]; unread_count: number }>(
        "/api/notifications/inbox?limit=15",
      );
      setItems(data.items);
      setUnread(data.unread_count);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    const onChange = () => void load();
    window.addEventListener("teambrain:org-changed", onChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("teambrain:org-changed", onChange);
    };
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markAllRead() {
    await apiClient.post("/api/notifications/inbox/read-all", {});
    await load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
        className="relative rounded-input p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-modal border border-slate-200 bg-white shadow-dropdown dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <span className="text-sm font-semibold">Notifications équipe</span>
            {unread > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-xs text-primary hover:underline">
                Tout marquer lu
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-500">Aucune notification</li>
            ) : (
              items.map((n) => {
                const href = n.link_path?.startsWith("/")
                  ? n.link_path
                  : `/${orgSlug}/${n.module}`;
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block border-b border-slate-50 px-3 py-2.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50",
                        !n.read_at && "bg-primary/5",
                      )}
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
