"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/app/lib/utils";

export type CalendarEventItem = {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  location?: string;
  event_type?: string;
  kind?: "event";
};

export type CalendarTaskItem = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  assignee_name?: string | null;
  kind: "task";
};

export type CalendarDayItem = CalendarEventItem | CalendarTaskItem;

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function buildMonthGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

function monthRange(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { from: toDateKey(from), to: toDateKey(to) };
}

export function useCalendarMonthRange(month: Date) {
  return useMemo(() => monthRange(month), [month]);
}

type Props = {
  month: Date;
  onMonthChange: (d: Date) => void;
  events: CalendarEventItem[];
  tasks: CalendarTaskItem[];
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
};

export function CalendarMonthView({
  month,
  onMonthChange,
  events,
  tasks,
  selectedDay,
  onSelectDay,
}: Props) {
  const todayKey = toDateKey(new Date());
  const selectedKey = selectedDay ? toDateKey(selectedDay) : null;

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarDayItem[]>();
    const push = (key: string, item: CalendarDayItem) => {
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    };
    for (const ev of events) {
      push(toDateKey(new Date(ev.start_datetime)), { ...ev, kind: "event" });
    }
    for (const task of tasks) {
      if (!task.due_date || task.status === "done") continue;
      push(task.due_date.slice(0, 10), task);
    }
    return map;
  }, [events, tasks]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const monthLabel = month.toLocaleDateString("fr", { month: "long", year: "numeric" });

  return (
    <div className="tb-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="tb-btn-secondary h-9 w-9 p-0"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold capitalize">{monthLabel}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onMonthChange(startOfMonth(now));
              onSelectDay(now);
            }}
            className="tb-btn-secondary h-9 px-3 text-xs"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, 1))}
            className="tb-btn-secondary h-9 w-9 p-0"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[88px] border-b border-r border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30" />;
          }
          const key = toDateKey(day);
          const dayItems = itemsByDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const inMonth = day.getMonth() === month.getMonth();

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-[88px] border-b border-r border-slate-100 p-1.5 text-left transition-colors hover:bg-primary/5 dark:border-slate-800",
                !inMonth && "opacity-40",
                isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/30",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm",
                  isToday && "bg-primary font-semibold text-white",
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                      item.kind === "task"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                        : "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
                    )}
                  >
                    {item.title}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <p className="px-1 text-[10px] text-slate-500">+{dayItems.length - 3}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" /> Événement
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Échéance tâche
        </span>
      </div>
    </div>
  );
}

export function itemsForDay(
  day: Date,
  events: CalendarEventItem[],
  tasks: CalendarTaskItem[],
): CalendarDayItem[] {
  const key = toDateKey(day);
  const out: CalendarDayItem[] = [];
  for (const ev of events) {
    if (toDateKey(new Date(ev.start_datetime)) === key) out.push({ ...ev, kind: "event" });
  }
  for (const task of tasks) {
    if (task.due_date?.slice(0, 10) === key && task.status !== "done") out.push(task);
  }
  return out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
    if (a.kind === "event" && b.kind === "event") {
      return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
    }
    return 0;
  });
}
