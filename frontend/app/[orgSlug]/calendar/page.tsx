"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient, BASE_URL } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canCreateContent, canEditContent, memberApprovalHint } from "@/app/lib/permissions";
import { t } from "@/app/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { TbCard } from "@/components/ui/tb-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { useGsapStagger } from "@/hooks/use-gsap-stagger";
import { useToast } from "@/components/ui/toast";

type Event = {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  location: string;
  event_type: string;
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canCreate = canCreateContent(user);
  const canEdit = canEditContent(user);
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Event | null>(null);
  const listRef = useGsapStagger<HTMLDivElement>([events.length]);

  const load = () => apiClient.get<{ items: Event[] }>("/api/calendar/events").then((r) => setEvents(r.items));
  useEffect(() => { void load(); }, []);

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
    toast("Événement créé", "success");
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
            {canCreate && (
              <button type="button" onClick={() => setShowForm(true)} className="tb-btn-primary h-10">
                Nouvel événement
              </button>
            )}
          </div>
        }
      />
      {showForm && (
        <form onSubmit={handleCreate} className="tb-card animate-slide-up space-y-3 p-4">
          <input name="title" placeholder="Titre" required className="tb-input" />
          <input name="start" type="datetime-local" required className="tb-input" />
          <input name="end" type="datetime-local" required className="tb-input" />
          <input name="location" placeholder="Lieu" className="tb-input" />
          <button type="submit" className="tb-btn-primary">{t("save")}</button>
        </form>
      )}
      <div ref={listRef} className="space-y-2">
        {events.map((ev) => (
          <TbCard key={ev.id} stagger interactive onClick={() => setSelected(ev)} className="p-4">
            <h3 className="font-medium">{ev.title}</h3>
            <p className="text-sm text-slate-500">
              {new Date(ev.start_datetime).toLocaleString("fr")} — {ev.location || "Sans lieu"}
            </p>
          </TbCard>
        ))}
      </div>

      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? "Événement"}>
        {selected && (
          <div className="space-y-3 text-sm">
            <p><span className="text-slate-500">Début :</span> {new Date(selected.start_datetime).toLocaleString("fr")}</p>
            <p><span className="text-slate-500">Fin :</span> {new Date(selected.end_datetime).toLocaleString("fr")}</p>
            <p><span className="text-slate-500">Lieu :</span> {selected.location || "—"}</p>
            {!canEdit && <p className="text-xs text-amber-700 dark:text-amber-400">{memberApprovalHint()} pour modifier.</p>}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
