"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { getTeamSizePreset } from "@/app/lib/org-terminology";
import { t } from "@/app/lib/i18n";
import { ActivityLineChart, MemberBarChart } from "@/components/dashboard/dashboard-charts";
import { useCountUp } from "@/components/dashboard/use-count-up";
import { TbCard } from "@/components/ui/tb-card";
import { useGsapStagger } from "@/hooks/use-gsap-stagger";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";

type Stats = {
  tasks_completed_week: number;
  tasks_completed_week_change_pct: number | null;
  active_projects: number;
  documents_month: number;
  documents_month_change_pct: number | null;
  memory_count: number;
  memory_growth_month: number;
};

type ActivityItem = {
  type: string;
  id: string;
  label: string;
  actor_name: string;
  at: string;
};

type PendingAction = {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type DashboardPayload = {
  kpis: Stats;
  team_size: string;
  setup_checklist?: Record<string, boolean>;
  pending_actions: PendingAction[];
  pending_actions_count: number;
  can_approve_pending: boolean;
};

const CHECKLIST_LABELS: Record<string, string> = {
  profile_completed: "Profil complété",
  team_invited: "Équipe invitée",
  first_project: "Premier projet créé",
  first_field_report: "Premier rapport terrain",
  first_meeting: "Première réunion analysée",
};

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const Icon = pct === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = pct === 0 ? "text-slate-400" : up ? "text-emerald-600" : "text-rose-600";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(pct)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  trend,
  suffix,
  onClick,
}: {
  label: string;
  value: number;
  trend?: number | null;
  suffix?: string;
  onClick?: () => void;
}) {
  const animated = useCountUp(value);
  return (
    <TbCard interactive onClick={onClick} className="p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        {trend !== undefined && <TrendBadge pct={trend} />}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">
        {animated}
        {suffix && <span className="ml-1 text-lg font-normal text-slate-500">{suffix}</span>}
      </p>
    </TbCard>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins || 1} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function activityText(item: ActivityItem) {
  const who = item.actor_name ?? "Quelqu'un";
  switch (item.type) {
    case "task":
      return `${who} a complété la tâche « ${item.label} »`;
    case "document":
      return `${who} a ajouté le document « ${item.label} »`;
    case "message":
      return `${who} a envoyé « ${item.label} »`;
    case "meeting":
      return `${who} a enregistré la réunion « ${item.label} »`;
    default:
      return item.label;
  }
}

function activityHref(orgSlug: string, item: ActivityItem) {
  const base = `/${orgSlug}`;
  switch (item.type) {
    case "task":
      return `${base}/tasks`;
    case "document":
      return `${base}/documents`;
    case "message":
      return `${base}/messages`;
    case "meeting":
      return `${base}/meetings`;
    default:
      return base;
  }
}

function pendingLabel(action: PendingAction) {
  const p = action.payload;
  if (action.action_type === "meeting_suggestion") {
    const msg = (p.dashboard_message as string) || (p.summary as string);
    return msg ? String(msg) : "Réunion WhatsApp — approuver les tâches suggérées";
  }
  if (action.action_type === "create_task" || action.action_type === "task_suggestion") return `Créer la tâche « ${p.title ?? "Sans titre"} »`;
  if (action.action_type === "update_task_status") return `Mettre à jour une tâche`;
  if (action.action_type === "whatsapp_send") return `Envoyer un message WhatsApp`;
  return action.action_type;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [chartData, setChartData] = useState<{ date: string; actions: number }[]>([]);
  const [members, setMembers] = useState<{ full_name: string; actions: number }[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const teamPreset = getTeamSizePreset(data?.team_size ?? (user?.settings?.team_size as string));
  const firstName = user?.full_name?.split(" ")[0] ?? "équipe";
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function loadDashboard() {
    const [dash, chart, contrib, recent] = await Promise.all([
      apiClient.get<DashboardPayload>("/api/dashboard"),
      apiClient.get<{ items: { date: string; actions: number }[] }>("/api/dashboard/activity-chart"),
      apiClient.get<{ items: { full_name: string; actions: number }[] }>("/api/dashboard/member-contributions"),
      apiClient.get<{ items: ActivityItem[] }>("/api/dashboard/recent-activity"),
    ]);
    setData(dash);
    setChartData(chart.items);
    setMembers(contrib.items);
    setActivity(recent.items);
  }

  useEffect(() => {
    void loadDashboard().catch(console.error);
    setChecklistDismissed(localStorage.getItem(`tb-checklist-${orgSlug}`) === "done");
  }, [orgSlug]);

  async function handlePending(actionId: string, approve: boolean) {
    setActionBusy(actionId);
    try {
      await apiClient.post(`/api/pending-actions/${actionId}/${approve ? "approve" : "reject"}`, {});
      await loadDashboard();
    } catch (e) {
      console.error(e);
    } finally {
      setActionBusy(null);
    }
  }

  const kpis = useMemo(() => {
    if (!data) return [];
    const s = data.kpis;
    if (teamPreset === "simple") {
      return [
        { label: "Tâches complétées cette semaine", value: s.tasks_completed_week, trend: s.tasks_completed_week_change_pct },
        { label: "Projets actifs", value: s.active_projects },
      ];
    }
    return [
      { label: "Tâches complétées cette semaine", value: s.tasks_completed_week, trend: s.tasks_completed_week_change_pct },
      { label: "Projets actifs", value: s.active_projects },
      { label: "Documents ajoutés ce mois", value: s.documents_month, trend: s.documents_month_change_pct },
      {
        label: "Mémoires du cerveau",
        value: s.memory_count,
        suffix: s.memory_growth_month > 0 ? `+${s.memory_growth_month}` : undefined,
      },
    ];
  }, [data, teamPreset]);

  const kpiRef = useGsapStagger<HTMLDivElement>([kpis.length, data?.kpis.tasks_completed_week]);

  if (!data) return <DashboardSkeleton />;

  const checklist = data.setup_checklist;
  const checklistDone = checklist ? Object.values(checklist).every(Boolean) : true;
  const showChecklist = checklist && !checklistDone && !checklistDismissed;

  function dismissChecklist() {
    localStorage.setItem(`tb-checklist-${orgSlug}`, "done");
    setChecklistDismissed(true);
  }

  const showCharts = teamPreset !== "simple";
  const showMemberChart = teamPreset === "full";

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

      <div ref={kpiRef} className={`grid gap-4 sm:grid-cols-2 ${teamPreset !== "simple" ? "xl:grid-cols-4" : ""}`}>
        {kpis.map((k, i) => (
          <div key={k.label} className="gsap-stagger-item">
            <KpiCard
              label={k.label}
              value={k.value}
              trend={k.trend}
              suffix={k.suffix}
              onClick={() => {
                if (i === 0) router.push(`/${orgSlug}/tasks`);
                else if (i === 1) router.push(`/${orgSlug}/projects`);
                else if (i === 2) router.push(`/${orgSlug}/documents`);
                else router.push(`/${orgSlug}/memory`);
              }}
            />
          </div>
        ))}
      </div>

      {showCharts && (
        <div className={`grid gap-6 ${showMemberChart ? "lg:grid-cols-2" : ""}`}>
          <section className="tb-card p-6">
            <h2 className="font-semibold">Activité de l&apos;équipe</h2>
            <p className="text-sm text-slate-500">30 derniers jours</p>
            <div className="mt-4">
              <ActivityLineChart data={chartData} />
            </div>
          </section>
          {showMemberChart && (
            <section className="tb-card p-6">
              <h2 className="font-semibold">Contributions par membre</h2>
              <p className="text-sm text-slate-500">Top 5 ce mois</p>
              <div className="mt-4">
                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">Pas encore de contributions</p>
                ) : (
                  <MemberBarChart data={members} />
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="tb-card p-6">
          <h2 className="font-semibold">Activité récente</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aucune activité récente</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {activity.map((a) => (
                <li key={`${a.type}-${a.id}`}>
                  <button
                    type="button"
                    onClick={() => router.push(activityHref(orgSlug, a))}
                    className="flex w-full items-start gap-3 rounded-input p-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Avatar name={a.actor_name ?? "?"} className="h-8 w-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2">{activityText(a)}</p>
                      <p className="text-xs text-slate-500">{relativeTime(a.at)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tb-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Actions en attente</h2>
            {(data.pending_actions_count ?? 0) > 0 && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                {data.pending_actions_count}
              </span>
            )}
          </div>
          {data.pending_actions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aucune action en attente</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.pending_actions.map((action) => (
                <li
                  key={action.id}
                  className="rounded-input border border-slate-100 p-3 dark:border-slate-800"
                >
                  <p className="text-sm font-medium">{pendingLabel(action)}</p>
                  <p className="text-xs text-slate-500">{relativeTime(action.created_at)}</p>
                  {data.can_approve_pending ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={actionBusy === action.id}
                        onClick={() => void handlePending(action.id, true)}
                        className="tb-btn-primary h-8 px-3 text-xs"
                      >
                        Approuver
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy === action.id}
                        onClick={() => void handlePending(action.id, false)}
                        className="tb-btn-secondary h-8 px-3 text-xs"
                      >
                        Rejeter
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      En attente d&apos;approbation
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.pending_actions_count > 5 && (
            <Link href={`/${orgSlug}/assistant`} className="mt-4 inline-block text-sm text-primary hover:underline">
              Voir toutes les suggestions →
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
