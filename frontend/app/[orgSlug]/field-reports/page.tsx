"use client";

import { FormEvent, useEffect, useState } from "react";
import { MapPin, MapPinned, Wifi, WifiOff } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";
import {
  getPendingReports,
  isOnline,
  saveOfflineReport,
  syncPendingReports,
} from "@/app/lib/offline-sync";
import { initials } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Report = {
  id: string;
  location_name: string;
  mission_date: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  ai_summary: string | null;
  synced_at: string | null;
};

type MapPoint = { id: string; location_name: string; latitude: number; longitude: number };

export default function FieldReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [r, m] = await Promise.all([
      apiClient.get<{ items: Report[] }>("/api/field-reports"),
      apiClient.get<{ points: MapPoint[] }>("/api/field-reports/map"),
    ]);
    setReports(r.items);
    setMapPoints(m.points);
    const p = await getPendingReports();
    setPending(p.length);
    setLoading(false);
  };

  useEffect(() => {
    setOnline(isOnline());
    const onOnline = () => {
      setOnline(true);
      void syncPendingReports((items) => apiClient.post("/api/sync/push", { items })).then(() => load());
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void load();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      mission_date: new Date().toISOString().split("T")[0],
      location_name: String(fd.get("location_name") || ""),
      description: String(fd.get("description") || ""),
      latitude: Number(fd.get("latitude") || 0) || undefined,
      longitude: Number(fd.get("longitude") || 0) || undefined,
    };

    try {
      if (!online) {
        const client_id = crypto.randomUUID();
        await saveOfflineReport({ client_id, ...payload, created_at: new Date().toISOString() });
        setPending((p) => p + 1);
        toast("Rapport enregistré hors ligne — synchronisation à la reconnexion", "info");
        e.currentTarget.reset();
        setShowForm(false);
        return;
      }
      await apiClient.post("/api/field-reports", payload);
      toast("Rapport terrain soumis", "success");
      e.currentTarget.reset();
      setShowForm(false);
      void load();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur lors de l'envoi", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function captureGps() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const lat = document.querySelector<HTMLInputElement>('input[name="latitude"]');
      const lng = document.querySelector<HTMLInputElement>('input[name="longitude"]');
      if (lat) lat.value = String(pos.coords.latitude);
      if (lng) lng.value = String(pos.coords.longitude);
      toast("Position GPS capturée", "success");
    });
  }

  if (loading) return <CardSkeleton lines={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("fieldReports")}
        description="Rapports de mission avec synchronisation hors ligne."
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                online
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? t("online") : t("offline")}
            </span>
            {pending > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {pending} {t("pendingSync")}
              </span>
            )}
            <button type="button" onClick={() => setShowForm(!showForm)} className="tb-btn-primary h-10">
              {t("newReport")}
            </button>
          </div>
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="tb-card animate-slide-up space-y-4 p-6">
          <div>
            <label className="tb-label" htmlFor="location_name">
              Lieu de mission
            </label>
            <input id="location_name" name="location_name" className="tb-input" placeholder="Ex. Thiès, zone nord" />
          </div>
          <div>
            <label className="tb-label" htmlFor="description">
              Observations *
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              className="tb-input min-h-[100px] py-2"
              placeholder="Décrivez la mission..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="tb-label" htmlFor="latitude">
                Latitude
              </label>
              <input id="latitude" name="latitude" type="number" step="any" className="tb-input" />
            </div>
            <div>
              <label className="tb-label" htmlFor="longitude">
                Longitude
              </label>
              <input id="longitude" name="longitude" type="number" step="any" className="tb-input" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={captureGps} className="tb-btn-secondary">
              <MapPinned className="h-4 w-4" />
              Capturer GPS
            </button>
            <button type="submit" disabled={submitting} className="tb-btn-primary h-10">
              {submitting ? "Envoi..." : "Soumettre le rapport"}
            </button>
          </div>
        </form>
      )}

      {mapPoints.length > 0 && (
        <section className="tb-card p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Carte ({mapPoints.length} points GPS)
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-500">
            {mapPoints.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {p.location_name} — {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reports.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Aucun rapport terrain"
          description="Soumettez votre premier rapport depuis le terrain, même hors connexion."
          action={
            <button type="button" onClick={() => setShowForm(true)} className="tb-btn-primary h-10">
              Soumettre votre premier rapport →
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => {
            const hasGps = r.latitude != null && r.longitude != null;
            const label = r.location_name || "Mission terrain";
            return (
              <article key={r.id} className="tb-card p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-primary dark:bg-indigo-950">
                    {initials(label)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {r.mission_date}
                      </span>
                      {hasGps && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <MapPinned className="h-3 w-3" />
                          GPS
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{r.description}</p>
                    )}
                    {r.ai_summary && (
                      <p className="mt-2 rounded-input bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <span className="text-xs font-medium text-primary">IA — </span>
                        {r.ai_summary}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
