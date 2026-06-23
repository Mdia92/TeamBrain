"use client";

import { FormEvent, useEffect, useState } from "react";
import { ClipboardList, MessageCircle, Smartphone } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";
import { initials } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { TbCard } from "@/components/ui/tb-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { useGsapStagger } from "@/hooks/use-gsap-stagger";

type StatusItem = {
  id: string;
  status_text: string;
  location_name: string | null;
  user_name: string;
  source: string;
  date: string;
};

function SourceBadge({ source }: { source: string }) {
  const isWhatsApp = source === "whatsapp";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isWhatsApp
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
      )}
    >
      {isWhatsApp ? <MessageCircle className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
      {isWhatsApp ? "WhatsApp" : "App"}
    </span>
  );
}

export default function DailyStatusPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<StatusItem | null>(null);
  const listRef = useGsapStagger<HTMLOListElement>([items.length]);

  const load = () =>
    apiClient
      .get<{ items: StatusItem[]; date: string }>("/api/daily-status")
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiClient.post("/api/daily-status", {
        status_text: fd.get("status_text"),
        location_name: fd.get("location_name"),
      });
      toast("Statut publié", "success");
      e.currentTarget.reset();
      setShowForm(false);
      void load();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CardSkeleton lines={5} />;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dailyStatus")}
        description={`Statuts de l'équipe — ${today}`}
        actions={
          <button type="button" onClick={() => setShowForm(!showForm)} className="tb-btn-primary h-10">
            Publier mon statut
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="tb-card animate-slide-up space-y-4 p-6">
          <div>
            <label className="tb-label" htmlFor="status_text">
              Votre statut du jour *
            </label>
            <textarea
              id="status_text"
              name="status_text"
              required
              rows={3}
              className="tb-input min-h-[80px] py-2"
              placeholder="Qu'avez-vous accompli aujourd'hui ?"
            />
          </div>
          <div>
            <label className="tb-label" htmlFor="location_name">
              Lieu (optionnel)
            </label>
            <input id="location_name" name="location_name" className="tb-input" placeholder="Ex. Bureau Dakar" />
          </div>
          <button type="submit" disabled={submitting} className="tb-btn-primary h-10">
            {submitting ? "Publication..." : "Publier"}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun statut aujourd'hui"
          description="Soyez le premier à partager votre avancement avec l'équipe."
          action={
            <button type="button" onClick={() => setShowForm(true)} className="tb-btn-primary h-10">
              Publier mon statut →
            </button>
          }
        />
      ) : (
        <ol ref={listRef} className="relative border-l-2 border-indigo-200 pl-6 dark:border-indigo-900">
          {items.map((item) => (
            <li key={item.id} className="relative mb-8 last:mb-0 gsap-stagger-item">
              <span className="absolute -left-[1.6rem] top-1 flex h-3 w-3 rounded-full bg-primary ring-4 ring-white dark:ring-slate-950" />
              <TbCard interactive onClick={() => setSelected(item)} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-primary dark:bg-indigo-950">
                    {initials(item.user_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{item.user_name}</span>
                      <SourceBadge source={item.source} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {item.status_text}
                    </p>
                    {item.location_name && (
                      <p className="mt-1 text-xs text-slate-500">{item.location_name}</p>
                    )}
                  </div>
                </div>
              </TbCard>
            </li>
          ))}
        </ol>
      )}

      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.user_name ?? "Statut"}>
        {selected && (
          <div className="space-y-3 text-sm">
            <SourceBadge source={selected.source} />
            <p className="leading-relaxed">{selected.status_text}</p>
            {selected.location_name && <p className="text-slate-500">{selected.location_name}</p>}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
