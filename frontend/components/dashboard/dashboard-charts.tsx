"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INDIGO = "#6366f1";
const GRID = "rgba(148, 163, 184, 0.2)";
const TICK = "#94a3b8";

type ChartPoint = { date: string; actions: number };
type MemberPoint = { full_name: string; actions: number };

function formatDate(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ActivityLineChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INDIGO} stopOpacity={0.35} />
            <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={{
            background: "var(--tooltip-bg, #1e293b)",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#f1f5f9",
          }}
          labelFormatter={(v) => new Date(String(v)).toLocaleDateString("fr-FR")}
        />
        <Area
          type="monotone"
          dataKey="actions"
          stroke={INDIGO}
          strokeWidth={2}
          fill="url(#activityFill)"
          dot={{ r: 3, fill: INDIGO, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MemberBarChart({ data }: { data: MemberPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    short: d.full_name.split(" ")[0],
    initials: initials(d.full_name),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="short"
          tick={{ fill: TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          contentStyle={{
            background: "var(--tooltip-bg, #1e293b)",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#f1f5f9",
          }}
          formatter={(v) => [`${v ?? 0} actions`, ""]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.full_name ?? ""}
        />
        <Bar dataKey="actions" fill={INDIGO} radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MemberAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
      {initials(name)}
    </span>
  );
}
