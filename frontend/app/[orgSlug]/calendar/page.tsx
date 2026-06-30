"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Sparkles } from "lucide-react";
import { apiClient, BASE_URL } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canCreateContent, canEditContent, memberApprovalHint } from "@/app/lib/permissions";
import { useTranslation } from "@/app/lib/use-locale";
import {
  CalendarMonthView,
  itemsForDay,
  useCalendarMonthRange,
  type CalendarEventItem,
  type CalendarTaskItem,
} from "@/components/calendar/calendar-month";
import { TbCard } from "@/components/ui/tb-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { useToast } from "@/components/ui/toast";

type Event = CalendarEventItem;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const params = useParams();
  const orgSlug = String(params.orgSlug ?? user?.org_slug ?? "app");
  const { toast } = useToast();
  const canCreate = canCreateContent(user);
  const canEdit = canEditContent(user);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<CalendarTaskItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useCalendarMonthRange(month);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, taskRes] = await Promise.all([
        apiClient.get<{ items: Event[] }>(
          `/api/calendar/events?from=${range.from}&to=${range.to}&limit=100`,
        ),
        apiClient.get<{ items: CalendarTaskItem[] }>("/api/tasks?limit=100"),
      ]);
      setEvents(evRes.items);
      setTasks(
        taskRes.items
          .filter((t) => t.due_date)
          .map((t) => ({ ...t, kind: "task" as const })),
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayItems = useMemo(
    () => (selectedDay ? itemsForDay(selectedDay, events, tasks) : []),
    [selectedDay, events, tasks],
  );

  const upcoming = useMemo(() => {
    const now = new Date();
    const merged = [
      ...events.map((e) => ({
        id: e.id,
        title: e.title,
        when: new Date(e.start_datetime),
        kind: "event" as const,
        location: e.location,
      })),
      ...tasks
        .filter((t) => t.due_date && t.status !== "done")
        .map((t) => ({
          id: t.id,
          title: t.title,
          when: new Date(t.due_date),
          kind: "task" as const,
          location: t.assignee_name ?? undefined,
        })),
    ];
    return merged
      .filter((i) => i.when >= now)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, 6);
  }, [events, tasks]);

  const assistantQuestion = selectedDay
    ? `Quels événements et échéances ai-je le ${selectedDay.toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })} ?`
    : "Quelles sont mes prochaines échéances et événements cette semaine ?";

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate) {
      toast(memberApprovalHint(), "info");
      return;
    }
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
    toast(t("calendarEventCreated"), "success");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("calendarPageDesc")}</p>
        <div className="flex flex-wrap gap-2">
          <a href={`${BASE_URL}/api/calendar/export.ics`} className="tb-btn-secondary" target="_blank" rel="noreferrer">
            Export iCal
          </a>
          {canCreate && (
            <button type="button" onClick={() => setShowForm(true)} className="tb-btn-primary h-10">
              {t("calendarNewEvent")}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="tb-card animate-slide-up space-y-3 p-4">
          <input name="title" placeholder="Titre" required className="tb-input" />
          <input name="start" type="datetime-local" required className="tb-input" />
          <input name="end" type="datetime-local" required className="tb-input" />
          <input name="location" placeholder="Lieu" className="tb-input" />
          <button type="submit" className="tb-btn-primary">{t("save")}</button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className={loading ? "opacity-60" : ""}>
          <CalendarMonthView
            month={month}
            onMonthChange={setMonth}
            events={events}
            tasks={tasks}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </div>

        <aside className="space-y-4">
          <TbCard className="p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Brain className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{t("assistantBrand")}</p>
                <p className="text-xs text-slate-500">{t("assistant")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {t("assistantCalendarDescription")}
            </p>
            <Link
              href={`/${orgSlug}/assistant?q=${encodeURIComponent(assistantQuestion)}`}
              className="tb-btn-primary mt-4 flex h-10 w-full items-center justify-center gap-2 text-sm"
            >
              <Sparkles className="h-4 w-4" />
              {t("askAssistantButton")}
            </Link>
          </TbCard>

          {selectedDay && (
            <TbCard className="p-4">
              <h3 className="font-medium capitalize">
                {selectedDay.toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              {dayItems.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Aucun événement ni échéance ce jour.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {dayItems.map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => item.kind === "event" && setSelectedEvent(item)}
                        className="w-full rounded-input border border-slate-200 px-3 py-2 text-left text-sm hover:border-primary/40 dark:border-slate-700"
                      >
                        <span className="text-xs font-medium uppercase text-slate-500">
                          {item.kind === "task" ? "Tâche" : "Événement"}
                        </span>
                        <p className="font-medium">{item.title}</p>
                        {item.kind === "event" && (
                          <p className="text-xs text-slate-500">
                            {new Date(item.start_datetime).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                            {item.location ? ` · ${item.location}` : ""}
                          </p>
                        )}
                        {item.kind === "task" && item.assignee_name && (
                          <p className="text-xs text-slate-500">{item.assignee_name}</p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TbCard>
          )}

          <TbCard className="p-4">
            <h3 className="font-medium">À venir</h3>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Rien de planifié prochainement.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {upcoming.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex gap-2 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                    <span className="shrink-0 text-xs text-slate-500">
                      {item.when.toLocaleDateString("fr", { day: "2-digit", month: "short" })}
                    </span>
                    <span>
                      <span className="font-medium">{item.title}</span>
                      <span className="block text-xs text-slate-500">
                        {item.kind === "task" ? "Échéance" : "Événement"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TbCard>
        </aside>
      </div>

      <DetailDrawer open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} title={selectedEvent?.title ?? "Événement"}>
        {selectedEvent && (
          <div className="space-y-3 text-sm">
            <p><span className="text-slate-500">Début :</span> {new Date(selectedEvent.start_datetime).toLocaleString("fr")}</p>
            <p><span className="text-slate-500">Fin :</span> {new Date(selectedEvent.end_datetime).toLocaleString("fr")}</p>
            <p><span className="text-slate-500">Lieu :</span> {selectedEvent.location || "—"}</p>
            {!canEdit && <p className="text-xs text-amber-700 dark:text-amber-400">{memberApprovalHint()} pour modifier.</p>}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
