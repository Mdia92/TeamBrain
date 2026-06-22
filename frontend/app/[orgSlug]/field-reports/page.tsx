"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";
import {
  getPendingReports,
  isOnline,
  saveOfflineReport,
  syncPendingReports,
} from "@/app/lib/offline-sync";

type Report = {
  id: string;
  location_name: string;
  mission_date: string;
  description: string;
  latitude: number;
  longitude: number;
  ai_summary: string;
};

type MapPoint = { id: string; location_name: string; latitude: number; longitude: number };

export default function FieldReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  const load = async () => {
    const [r, m] = await Promise.all([
      apiClient.get<{ items: Report[] }>("/api/field-reports"),
      apiClient.get<{ points: MapPoint[] }>("/api/field-reports/map"),
    ]);
    setReports(r.items);
    setMapPoints(m.points);
    const p = await getPendingReports();
    setPending(p.length);
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
    const fd = new FormData(e.currentTarget);
    const payload = {
      mission_date: new Date().toISOString().split("T")[0],
      location_name: String(fd.get("location_name") || ""),
      description: String(fd.get("description") || ""),
      latitude: Number(fd.get("latitude") || 0) || undefined,
      longitude: Number(fd.get("longitude") || 0) || undefined,
    };

    if (!online) {
      const client_id = crypto.randomUUID();
      await saveOfflineReport({ client_id, ...payload, created_at: new Date().toISOString() });
      setPending((p) => p + 1);
      e.currentTarget.reset();
      return;
    }

    await apiClient.post("/api/field-reports", payload);
    e.currentTarget.reset();
    void load();
  }

  function captureGps() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const lat = document.querySelector<HTMLInputElement>('input[name="latitude"]');
      const lng = document.querySelector<HTMLInputElement>('input[name="longitude"]');
      if (lat) lat.value = String(pos.coords.latitude);
      if (lng) lng.value = String(pos.coords.longitude);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("fieldReports")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className={online ? "text-green-600" : "text-amber-600"}>
            {online ? t("online") : t("offline")}
          </span>
          {pending > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
              {pending} {t("pendingSync")}
            </span>
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3 dark:border-stone-800 dark:bg-stone-900">
        <input name="location_name" placeholder="Lieu de mission" className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
        <textarea name="description" placeholder="Observations" required rows={4} className="w-full rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
        <div className="flex gap-2">
          <input name="latitude" type="number" step="any" placeholder="Latitude" className="flex-1 rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <input name="longitude" type="number" step="any" placeholder="Longitude" className="flex-1 rounded-lg border px-3 py-2 dark:border-stone-700 dark:bg-stone-800" />
          <button type="button" onClick={captureGps} className="rounded-lg border px-3 py-2 text-sm">GPS</button>
        </div>
        <button type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white">{t("newReport")}</button>
      </form>
      {mapPoints.length > 0 && (
        <div className="rounded-xl border p-4 dark:border-stone-800">
          <h2 className="font-semibold mb-2">Carte ({mapPoints.length} points)</h2>
          <ul className="text-sm space-y-1">
            {mapPoints.map((p) => (
              <li key={p.id}>{p.location_name} — {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <h3 className="font-medium">{r.location_name}</h3>
            <p className="text-sm text-stone-500">{r.mission_date}</p>
            {r.ai_summary && <p className="mt-1 text-sm">{r.ai_summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
