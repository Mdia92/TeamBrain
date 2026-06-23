"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, FolderKanban, MapPin, Minus, X } from "lucide-react";
import { useParams } from "next/navigation";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardSkeleton } from "@/components/ui/skeleton";

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
  pending_actions_count?: number;
};

const CHECKLIST_LABELS: Record<string, string> = {
  profile_completed: "Profil complété",
  team_invited: "Équipe invitée",
  first_project: "Premier projet créé",
  first_field_report: "Premier rapport terrain",
  first_meeting: "Première réunion analysée",
};

function Trend({ value, invert }: { value: number; invert?: boolean }) {
  const up = invert ? value > 0 : value >= 0;
  const Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = value === 0 ? "text-slate-400" : up ? "text-emerald-600" : "text-rose-600";
  return <Icon className={`h-4 w-4 ${color}`} />;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [checklistDismissed, setChecklistDismissed] = useState(false);

  const firstName = user?.full_name?.split(" ")[0] ?? "équipe";
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  useEffect(() => {
    apiClient.get<DashboardData>("/api/dashboard").then(setData).catch(console.error);
    setChecklistDismissed(localStorage.getItem(`tb-checklist-${orgSlug}`) === "done");
  }, [orgSlug]);

  const activity = useMemo(() => {
    if (!data) return [];
    const items: { id: string; text: string; time: string; type: string }[] = [];
    for (const d of data.upcoming_deadlines.slice(0, 5)) {
      items.push({
        id: `task-${d.id}`,
        text: `Échéance : ${d.title}`,
        time: d.due_date,
        type: "task",
      });
    }
    for (const r of data.recent_field_reports.slice(0, 5)) {
      items.push({
        id: `fr-${r.id}`,
        text: `Rapport terrain : ${r.location_name || "Sans lieu"}`,
        time: r.mission_date,
        type: "field",
      });
    }
    return items.slice(0, 10);
  }, [data]);

  if (!data) return <DashboardSkeleton />;

  const checklist = data.setup_checklist;
  const checklistDone = checklist ? Object.values(checklist).every(Boolean) : true;
  const showChecklist = checklist && !checklistDone && !checklistDismissed;

  const kpis = [
    {
      label: t("activeProjects"),
      value: data.kpis.active_projects,
      trend: data.kpis.active_projects > 0 ? 1 : 0,
    },
    {
      label: t("tasksThisWeek"),
      value: data.kpis.tasks_completed_week,
      trend: data.kpis.tasks_completed_week > 0 ? 1 : 0,
    },
    {
      label: t("overdueTasks"),
      value: data.kpis.overdue_tasks,
      trend: data.kpis.overdue_tasks,
      alert: data.kpis.overdue_tasks > 0,
      invert: true,
    },
    {
      label: t("fieldReportsWeek"),
      value: data.kpis.field_reports_week,
      trend: data.kpis.field_reports_week > 0 ? 1 : 0,
    },
  ];

  function dismissChecklist() {
    localStorage.setItem(`tb-checklist-${orgSlug}`, "done");
    setChecklistDismissed(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${firstName}`}
        description={today.charAt(0).toUpperCase() + today.slice(1)}
        breadcrumbs={[{ label: user?.org_name ?? orgSlug }, { label: t("dashboard") }]}
      />

      {showChecklist && (
        <section className="tb-card relative border-accent/30 bg-amber-50/50 p-6 dark:bg-amber-950/20">
          <button
            type="button"
            onClick={dismissChecklist}
            className="absolute right-3 top-3 rounded-input p-1 text-slate-400 hover:bg-white/50"
            aria-label="Masquer"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Configuration initiale</h2>
          <ul className="mt-4 space-y-2">
            {Object.entries(checklist).map(([key, done]) => (
              <li key={key} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {done ? "✓" : ""}
                </span>
                {CHECKLIST_LABELS[key] ?? key}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.pending_actions_count != null && data.pending_actions_count > 0 && (
        <section className="tb-card border-primary/30 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Actions en attente</h2>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
              {data.pending_actions_count}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            L&apos;assistant a des suggestions à valider — ouvrez l&apos;assistant pour approuver ou rejeter.
          </p>
          <Link href={`/${orgSlug}/assistant`} className="tb-btn-primary mt-4 inline-flex min-h-11">
            Voir les suggestions →
          </Link>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`tb-card p-6 ${k.alert ? "border-rose-200 dark:border-rose-900" : ""}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{k.label}</p>
              <Trend value={k.trend} invert={k.invert} />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="tb-card p-6">
          <h2 className="font-semibold">{t("upcomingDeadlines")}</h2>
          {data.upcoming_deadlines.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aucune échéance cette semaine</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {data.upcoming_deadlines.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium">{d.title}</span>
                  <span className="text-slate-500">{d.due_date}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tb-card p-6">
          <h2 className="font-semibold">Activité récente</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aucune activité récente</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 rounded-md bg-indigo-50 p-1.5 text-primary dark:bg-indigo-950">
                    {a.type === "field" ? <MapPin className="h-3.5 w-3.5" /> : <FolderKanban className="h-3.5 w-3.5" />}
                  </span>
                  <div>
                    <p>{a.text}</p>
                    <p className="text-xs text-slate-500">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.recent_field_reports.length > 0 && (
        <section className="tb-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Rapports terrain récents</h2>
            <Link href={`/${orgSlug}/documents?tab=field_report`} className="text-sm text-primary hover:underline">
              Voir tout →
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {data.recent_field_reports.map((r) => (
              <li key={r.id} className="rounded-input border border-slate-100 p-3 dark:border-slate-800">
                <span className="font-medium">{r.location_name}</span>
                <span className="text-slate-500"> — {r.mission_date}</span>
                {r.ai_summary && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{r.ai_summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
