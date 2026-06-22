"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { t } from "@/app/lib/i18n";

type DashboardData = {
  kpis: {
    active_projects: number;
    tasks_completed_week: number;
    overdue_tasks: number;
    field_reports_week: number;
  };
  upcoming_deadlines: { id: string; title: string; due_date: string; priority: string }[];
  recent_field_reports: { id: string; location_name: string; mission_date: string; ai_summary: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiClient.get<DashboardData>("/api/dashboard").then(setData).catch(console.error);
  }, []);

  if (!data) return <p className="text-stone-500">{t("loading")}</p>;

  const kpis = [
    { label: t("activeProjects"), value: data.kpis.active_projects },
    { label: t("tasksThisWeek"), value: data.kpis.tasks_completed_week },
    { label: t("overdueTasks"), value: data.kpis.overdue_tasks, alert: data.kpis.overdue_tasks > 0 },
    { label: t("fieldReportsWeek"), value: data.kpis.field_reports_week },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border p-4 ${
              k.alert
                ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
            }`}
          >
            <p className="text-sm text-stone-500">{k.label}</p>
            <p className="mt-1 text-3xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="font-semibold">{t("upcomingDeadlines")}</h2>
          <ul className="mt-3 space-y-2">
            {data.upcoming_deadlines.length === 0 ? (
              <li className="text-sm text-stone-500">Aucune échéance cette semaine</li>
            ) : (
              data.upcoming_deadlines.map((d) => (
                <li key={d.id} className="flex justify-between text-sm">
                  <span>{d.title}</span>
                  <span className="text-stone-400">{d.due_date}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="font-semibold">Rapports terrain récents</h2>
          <ul className="mt-3 space-y-2">
            {data.recent_field_reports.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium">{r.location_name}</span>
                <span className="text-stone-400"> — {r.mission_date}</span>
                {r.ai_summary && <p className="text-stone-500">{r.ai_summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
