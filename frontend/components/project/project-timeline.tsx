"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";

export type TimelineTask = {
  id: string;
  title: string;
  status: string;
  start_date: string;
  due_date: string;
  assignee_name?: string | null;
};

export type TimelineDependency = {
  task_id: string;
  depends_on_task_id: string;
};

type Props = {
  projectId: string;
  canEdit: boolean;
  onRefresh?: () => void;
};

const DAY_MS = 86_400_000;
const ROW_H = 44;
const LABEL_W = 200;
const DAY_W = 28;

function parseDate(s: string) {
  return new Date(`${s.slice(0, 10)}T12:00:00`);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function ProjectTimeline({ projectId, canEdit, onRefresh }: Props) {
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [deps, setDeps] = useState<TimelineDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<{ id: string; startX: number; origStart: Date; origEnd: Date } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get<{
        tasks: TimelineTask[];
        dependencies: TimelineDependency[];
      }>(`/api/projects/${projectId}/timeline`);
      setTasks(r.tasks);
      setDeps(r.dependencies);
      setError("");
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { rangeStart, totalDays, todayOffset } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      return { rangeStart: today, totalDays: 14, todayOffset: 0 };
    }
    let min = parseDate(tasks[0].start_date);
    let max = parseDate(tasks[0].due_date);
    for (const t of tasks) {
      const s = parseDate(t.start_date);
      const e = parseDate(t.due_date);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    const pad = 2;
    const start = addDays(min, -pad);
    const end = addDays(max, pad);
    const days = Math.max(7, daysBetween(start, end) + 1);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return {
      rangeStart: start,
      totalDays: days,
      todayOffset: daysBetween(start, today),
    };
  }, [tasks]);

  const dayHeaders = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart, totalDays]);

  const taskIndex = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [tasks]);

  const barGeom = useCallback(
    (task: TimelineTask) => {
      const start = parseDate(task.start_date);
      const end = parseDate(task.due_date);
      const colStart = daysBetween(rangeStart, start);
      const span = Math.max(1, daysBetween(start, end) + 1);
      return { colStart, span };
    },
    [rangeStart],
  );

  const depLines = useMemo(() => {
    return deps
      .map((d) => {
        const fromIdx = taskIndex.get(d.depends_on_task_id);
        const toIdx = taskIndex.get(d.task_id);
        const fromTask = tasks.find((t) => t.id === d.depends_on_task_id);
        const toTask = tasks.find((t) => t.id === d.task_id);
        if (fromIdx == null || toIdx == null || !fromTask || !toTask) return null;
        const fromBar = barGeom(fromTask);
        const toBar = barGeom(toTask);
        const x1 = LABEL_W + (fromBar.colStart + fromBar.span) * DAY_W - DAY_W / 2;
        const y1 = fromIdx * ROW_H + ROW_H / 2;
        const x2 = LABEL_W + toBar.colStart * DAY_W + DAY_W / 2;
        const y2 = toIdx * ROW_H + ROW_H / 2;
        return { key: `${d.depends_on_task_id}-${d.task_id}`, x1, y1, x2, y2 };
      })
      .filter(Boolean) as { key: string; x1: number; y1: number; x2: number; y2: number }[];
  }, [deps, tasks, taskIndex, barGeom]);

  async function persistDates(taskId: string, start: Date, end: Date) {
    try {
      await apiClient.patch(`/api/tasks/${taskId}/dates`, {
        start_date: dateKey(start),
        due_date: dateKey(end),
      });
      void load();
      onRefresh?.();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Erreur de mise à jour");
    }
  }

  function onPointerDown(e: React.PointerEvent, task: TimelineTask) {
    if (!canEdit) return;
    const start = parseDate(task.start_date);
    const end = parseDate(task.due_date);
    setDrag({ id: task.id, startX: e.clientX, origStart: start, origEnd: end });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const deltaDays = Math.round((e.clientX - drag.startX) / DAY_W);
    if (deltaDays === 0) return;
    const newStart = addDays(drag.origStart, deltaDays);
    const newEnd = addDays(drag.origEnd, deltaDays);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === drag.id
          ? { ...t, start_date: dateKey(newStart), due_date: dateKey(newEnd) }
          : t,
      ),
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const task = tasks.find((t) => t.id === drag.id);
    if (task) {
      void persistDates(task.id, parseDate(task.start_date), parseDate(task.due_date));
    }
    setDrag(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Chargement de la chronologie…</p>;
  if (tasks.length === 0) {
    return (
      <p className="rounded-input border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
        Ajoutez des tâches avec des dates pour afficher la chronologie.
      </p>
    );
  }

  const gridWidth = LABEL_W + totalDays * DAY_W;
  const gridHeight = tasks.length * ROW_H;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {canEdit && (
        <p className="text-xs text-slate-500">Glissez une barre horizontalement pour ajuster les dates (managers+).</p>
      )}
      <div className="overflow-x-auto rounded-input border border-slate-200 dark:border-slate-800">
        <div style={{ width: gridWidth, minWidth: "100%" }} className="relative">
          <div
            className="grid border-b border-slate-200 bg-slate-50 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50"
            style={{ gridTemplateColumns: `${LABEL_W}px repeat(${totalDays}, ${DAY_W}px)` }}
          >
            <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-2 py-2 font-medium dark:border-slate-800 dark:bg-slate-900/50">
              Tâche
            </div>
            {dayHeaders.map((d) => (
              <div
                key={dateKey(d)}
                className={cn(
                  "border-r border-slate-100 py-2 text-center dark:border-slate-800",
                  dateKey(d) === dateKey(new Date()) && "bg-primary/5 font-semibold text-primary",
                )}
              >
                {d.getDate()}
              </div>
            ))}
          </div>

          <div ref={gridRef} className="relative" style={{ height: gridHeight }}>
            {todayOffset >= 0 && todayOffset < totalDays && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-primary/40"
                style={{ left: LABEL_W + todayOffset * DAY_W + DAY_W / 2 }}
              />
            )}

            <svg
              className="pointer-events-none absolute left-0 top-0 z-[5]"
              width={gridWidth}
              height={gridHeight}
              aria-hidden
            >
              {depLines.map((line) => (
                <g key={line.key}>
                  <path
                    d={`M ${line.x1} ${line.y1} C ${line.x1 + 24} ${line.y1}, ${line.x2 - 24} ${line.y2}, ${line.x2} ${line.y2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="text-slate-400"
                    markerEnd="url(#arrow)"
                  />
                </g>
              ))}
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-slate-400" />
                </marker>
              </defs>
            </svg>

            {tasks.map((task, rowIdx) => {
              const { colStart, span } = barGeom(task);
              const overdue =
                task.status !== "done" && parseDate(task.due_date) < new Date(new Date().toDateString());
              return (
                <div
                  key={task.id}
                  className="absolute flex items-center border-b border-slate-100 dark:border-slate-800"
                  style={{ top: rowIdx * ROW_H, height: ROW_H, width: gridWidth }}
                >
                  <div
                    className="sticky left-0 z-10 truncate border-r border-slate-200 bg-white px-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-950"
                    style={{ width: LABEL_W, height: ROW_H, lineHeight: `${ROW_H}px` }}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                  <div
                    className="relative"
                    style={{ width: totalDays * DAY_W, height: ROW_H }}
                  >
                    <div
                      role="button"
                      tabIndex={canEdit ? 0 : -1}
                      onPointerDown={(e) => onPointerDown(e, task)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      className={cn(
                        "absolute top-2 flex h-7 items-center rounded px-2 text-[10px] font-medium text-white shadow-sm",
                        overdue ? "bg-rose-500" : task.status === "done" ? "bg-emerald-500" : "bg-indigo-500",
                        canEdit && "cursor-grab active:cursor-grabbing",
                      )}
                      style={{
                        left: colStart * DAY_W + 2,
                        width: span * DAY_W - 4,
                      }}
                      title={`${task.start_date} → ${task.due_date}`}
                    >
                      <span className="truncate">{task.assignee_name ?? task.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
