"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BellRing,
  CheckCircle2,
  Clock,
  Minus,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatRelativeTime, localeTag } from "@/app/lib/format-locale";
import { getTeamSizePreset } from "@/app/lib/org-terminology";
import { useTranslation } from "@/app/lib/use-locale";
import type { I18nKey } from "@/app/lib/i18n";
import { ActivityLineChart, MemberBarChart } from "@/components/dashboard/dashboard-charts";
import { useCountUp } from "@/components/dashboard/use-count-up";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/app/lib/utils";

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

const CHECKLIST_KEYS: Record<string, I18nKey> = {
  profile_completed: "checklistProfile",
  team_invited: "checklistTeam",
  first_project: "checklistProject",
  first_field_report: "checklistFieldReport",
  first_meeting: "checklistMeeting",
};

type KpiColor = "indigo" | "amber" | "emerald" | "slate";

function KpiCard({
  label,
  value,
  trend,
  suffix,
  description,
  color,
  onClick,
}: {
  label: string;
  value: number;
  trend?: number | null;
  suffix?: string;
  description?: string;
  color: KpiColor;
  onClick?: () => void;
}) {
  const animated = useCountUp(value);
  const trendUp = trend !== undefined && trend !== null && trend >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-left shadow-xs transition-all duration-200 hover:scale-[1.02] hover:shadow-md dark:border-slate-800 dark:bg-slate-850"
    >
      <div
        className={cn(
          "absolute bottom-0 left-0 top-0 w-1.5",
          color === "indigo" && "bg-indigo-500",
          color === "amber" && "bg-amber-500",
          color === "emerald" && "bg-emerald-500",
          color === "slate" && "bg-slate-500",
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {trend !== undefined && trend !== null && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-extrabold",
              trend === 0
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                : trendUp
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
            )}
          >
            {trend === 0 ? <Minus className="h-3.5 w-3.5" /> : trendUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {trend === 0 ? "—" : `${Math.abs(trend)}%`}
          </span>
        )}
        {suffix && !trend && trend !== 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800">{suffix}</span>
        )}
      </div>
      <h3 className="mt-3 text-3xl font-extrabold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white">
        {animated}
        {suffix && trend === undefined && <span className="ml-1 text-lg font-normal text-slate-500">{suffix}</span>}
      </h3>
      {description && <p className="mt-1.5 truncate text-xs text-slate-400 dark:text-slate-500">{description}</p>}
    </button>
  );
}

function activityText(item: ActivityItem, t: (key: I18nKey) => string) {
  const who = item.actor_name ?? t("someone");
  switch (item.type) {
    case "task":
      return `${who} ${t("activityTaskDone")} « ${item.label} »`;
    case "document":
      return `${who} ${t("activityDocumentAdded")} « ${item.label} »`;
    case "message":
      return `${who} ${t("activityMessageSent")} « ${item.label} »`;
    case "meeting":
      return `${who} ${t("activityMeetingRecorded")} « ${item.label} »`;
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

function pendingLabel(action: PendingAction, t: (key: I18nKey) => string) {
  const p = action.payload;
  if (action.action_type === "meeting_suggestion") {
    const msg = (p.dashboard_message as string) || (p.summary as string);
    return msg ? String(msg) : t("pendingMeetingWhatsapp");
  }
  if (action.action_type === "create_task" || action.action_type === "task_suggestion") {
    return `${t("pendingCreateTask")} « ${p.title ?? t("untitled")} »`;
  }
  if (action.action_type === "update_task_status") return t("pendingUpdateTask");
  if (action.action_type === "whatsapp_send") return t("pendingWhatsappSend");
  return action.action_type;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
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
  const firstName = user?.full_name?.split(" ")[0] ?? t("teamFallback");

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
    const items = [
      {
        label: t("kpiCampaignTasks"),
        value: s.tasks_completed_week,
        trend: s.tasks_completed_week_change_pct,
        description: t("kpiCampaignDesc"),
        color: "indigo" as const,
      },
      {
        label: t("activeProjects"),
        value: s.active_projects,
        description: t("kpiActiveProjectsDesc"),
        color: "amber" as const,
      },
      {
        label: t("kpiDocumentsMonth"),
        value: s.documents_month,
        trend: s.documents_month_change_pct,
        description: t("kpiDocumentsDesc"),
        color: "emerald" as const,
      },
      {
        label: t("kpiBrainMemories"),
        value: s.memory_count,
        suffix: s.memory_growth_month > 0 ? `+${s.memory_growth_month}` : undefined,
        description: t("kpiBrainDesc"),
        color: "slate" as const,
      },
    ];
    if (teamPreset === "simple") return items.slice(0, 2);
    return items;
  }, [data, teamPreset, t]);

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

  const now = new Date();
  const dateLabel = now.toLocaleDateString(localeTag(locale), { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = now.toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8">
      <div className="relative flex min-h-[5rem] items-center justify-between gap-4 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 p-6 text-white shadow-md">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("dashboardHello")} {firstName} 👋
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-2.5 rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-right">
          <Clock className="h-4 w-4 shrink-0 animate-pulse text-indigo-400" />
          <div>
            <span className="block text-xs font-semibold text-slate-200">{dateLabel}</span>
            <span className="block text-[10px] text-slate-400">
              {t("dashboardLocalTime")} : {timeLabel}
            </span>
          </div>
        </div>
      </div>

      {showChecklist && (
        <section className="relative rounded-xl border border-amber-200/50 bg-amber-50/50 p-6 dark:border-amber-900/40 dark:bg-amber-950/20">
          <button
            type="button"
            onClick={dismissChecklist}
            className="absolute right-3 top-3 rounded-input p-1 text-slate-400 hover:bg-white/50"
            aria-label={t("hide")}
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("checklistTitle")}</h2>
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
                {CHECKLIST_KEYS[key] ? t(CHECKLIST_KEYS[key]) : key}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${teamPreset !== "simple" ? "lg:grid-cols-4" : ""}`}>
        {kpis.map((k, i) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            trend={k.trend}
            suffix={k.suffix}
            description={k.description}
            color={k.color}
            onClick={() => {
              if (i === 0) router.push(`/${orgSlug}/tasks`);
              else if (i === 1) router.push(`/${orgSlug}/projects`);
              else if (i === 2) router.push(`/${orgSlug}/documents`);
              else router.push(`/${orgSlug}/memory`);
            }}
          />
        ))}
      </div>

      {showCharts && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  {t("chartActivityTitle")}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">{t("chartActivityDesc")}</p>
              </div>
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                {t("chartLast30Days")}
              </span>
            </div>
            <ActivityLineChart data={chartData} />
          </section>
          {showMemberChart && (
            <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850 lg:col-span-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Award className="h-4 w-4 text-amber-500" />
                {t("contributorsTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{t("contributorsDesc")}</p>
              <div className="mt-4 flex-1">
                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("noContributionsYet")}</p>
                ) : (
                  <MemberBarChart data={members} />
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex h-[400px] flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {t("liveActivityTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{t("liveActivityDesc")}</p>
            </div>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noRecentActivity")}</p>
          ) : (
            <ul className="flex-1 space-y-3 overflow-y-auto pr-1">
              {activity.map((a) => (
                <li key={`${a.type}-${a.id}`}>
                  <button
                    type="button"
                    onClick={() => router.push(activityHref(orgSlug, a))}
                    className="flex w-full gap-3 rounded-lg border border-transparent p-2.5 text-left text-xs transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-bold text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                      {(a.actor_name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="leading-relaxed text-slate-800 dark:text-slate-200">{activityText(a, t)}</p>
                      <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(a.at, locale)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex h-[400px] flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <BellRing className="h-4 w-4 text-indigo-500" />
                {t("pendingActionsTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{t("pendingActionsDesc")}</p>
            </div>
            {(data.pending_actions_count ?? 0) > 0 && (
              <span className="rounded-md border border-amber-200/30 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                {data.pending_actions_count} {t("pendingUrgent")}
              </span>
            )}
          </div>
          {data.pending_actions.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <CheckCircle2 className="mb-2 h-10 w-10 animate-bounce text-emerald-500" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{t("noPendingActions")}</h4>
            </div>
          ) : (
            <ul className="flex-1 space-y-4 overflow-y-auto pr-1">
              {data.pending_actions.map((action) => (
                <li
                  key={action.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{pendingLabel(action, t)}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatRelativeTime(action.created_at, locale)}</p>
                  {data.can_approve_pending ? (
                    <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={actionBusy === action.id}
                        onClick={() => void handlePending(action.id, false)}
                        className="flex items-center gap-1 rounded-md bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t("reject")}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy === action.id}
                        onClick={() => void handlePending(action.id, true)}
                        className="flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-600 shadow-xs transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("approve")}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t("awaitingApproval")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
