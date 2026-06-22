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
  setup_checklist?: {
    profile_completed: boolean;
    team_invited: boolean;
    first_project: boolean;
    first_field_report: boolean;
    first_meeting: boolean;
  };
};

const CHECKLIST_LABELS: Record<string, string> = {
  profile_completed: "Profil complété",
  team_invited: "Équipe invitée",
  first_project: "Premier projet créé",
  first_field_report: "Premier rapport terrain",
  first_meeting: "Première réunion analysée",
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

  const checklist = data.setup_checklist;
  const checklistDone = checklist
    ? Object.values(checklist).every(Boolean)
    : true;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard")}</h1>

      {checklist && !checklistDone && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-semibold">Configuration initiale</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(checklist).map(([key, done]) => (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span className={done ? "text-green-600" : "text-stone-400"}>
                  {done ? "☑" : "☐"}
                </span>
                {CHECKLIST_LABELS[key] ?? key}
              </li>
            ))}
          </ul>
        </section>
      )}

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
