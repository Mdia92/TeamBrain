"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";

type StatusItem = {
  id: string;
  status_text: string;
  location_name: string;
  user_name: string;
  source: string;
  date: string;
};

export default function DailyStatusPage() {
  const [items, setItems] = useState<StatusItem[]>([]);

  const load = () =>
    apiClient.get<{ items: StatusItem[] }>("/api/daily-status").then((r) => setItems(r.items));

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await apiClient.post("/api/daily-status", {
      status_text: fd.get("status_text"),
      location_name: fd.get("location_name"),
    });
    e.currentTarget.reset();
    void load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dailyStatus")}</h1>
      <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3 dark:border-stone-800 dark:bg-stone-900">
        <textarea
          name="status_text"
          placeholder="Votre statut du jour..."
          required
          rows={3}
          className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
        />
        <input
          name="location_name"
          placeholder="Lieu (optionnel)"
          className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
        />
        <button type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white">
          Publier
        </button>
      </form>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between">
              <span className="font-medium">{item.user_name}</span>
              <span className="text-xs text-stone-400">{item.source}</span>
            </div>
            <p className="mt-1 text-sm">{item.status_text}</p>
            {item.location_name && (
              <p className="mt-1 text-xs text-stone-500">{item.location_name}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
