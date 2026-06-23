"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient, BASE_URL } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";

type Event = {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  location: string;
  event_type: string;
};

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = () => apiClient.get<{ items: Event[] }>("/api/calendar/events").then((r) => setEvents(r.items));
  useEffect(() => { void load(); }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await apiClient.post("/api/calendar/events", {
      title: fd.get("title"),
      start_datetime: fd.get("start"),
      end_datetime: fd.get("end"),
      location: fd.get("location"),
      event_type: "meeting",
      attendee_ids: [],
    });
    setShowForm(false);
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("calendar")}
        actions={
          <div className="flex gap-2">
            <a href={`${BASE_URL}/api/calendar/export.ics`} className="tb-btn-secondary" target="_blank" rel="noreferrer">
              Export iCal
            </a>
            <button type="button" onClick={() => setShowForm(true)} className="tb-btn-primary h-10">
              Nouvel événement
            </button>
          </div>
        }
      />
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border p-4 space-y-3 dark:border-stone-800">
          <input name="title" placeholder="Titre" required className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <input name="start" type="datetime-local" required className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <input name="end" type="datetime-local" required className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <input name="location" placeholder="Lieu" className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <button type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white">{t("save")}</button>
        </form>
      )}
      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <h3 className="font-medium">{ev.title}</h3>
            <p className="text-sm text-stone-500">
              {new Date(ev.start_datetime).toLocaleString("fr")} — {ev.location}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
