"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bot, Calendar, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";
import { initials } from "@/components/ui/avatar";
import { TbCard } from "@/components/ui/tb-card";

export type BoardTask = {
  id: string;
  title: string;
  priority?: string;
  assignee_name?: string;
  assignee_id?: string | null;
  due_date?: string;
  source?: string;
  source_reference?: string | null;
  status: string;
};

const COLUMNS = [
  { id: "todo", label: "À faire" },
  { id: "in_progress", label: "En cours" },
  { id: "review", label: "Revue" },
  { id: "done", label: "Terminé" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

function isOverdue(due?: string): boolean {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function TaskProvenance({ task, orgSlug }: { task: BoardTask; orgSlug?: string }) {
  if (task.source === "meeting_ai") {
    return (
      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-primary dark:bg-indigo-950">
        <Bot className="h-3 w-3" />
        Meeting AI
      </p>
    );
  }
  if (task.source === "whatsapp") {
    return (
      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800">
        <MessageCircle className="h-3 w-3" />
        WhatsApp
      </p>
    );
  }
  if (task.source === "meeting_ai" && task.source_reference && orgSlug) {
    return (
      <Link href={`/${orgSlug}/meetings`} className="text-xs text-primary">
        <Calendar className="inline h-3 w-3" /> Meeting AI
      </Link>
    );
  }
  return null;
}

function TaskCard({
  task,
  orgSlug,
  onClick,
  draggable,
}: {
  task: BoardTask;
  orgSlug?: string;
  onClick?: () => void;
  draggable?: boolean;
}) {
  const overdue = isOverdue(task.due_date);
  const priority = task.priority ?? "medium";

  return (
    <TbCard
      className={cn("p-3 shadow-card", draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
      onClick={onClick}
      interactive={Boolean(onClick) && !draggable}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            {task.assignee_name ? (
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-primary dark:bg-indigo-950">
                  {initials(task.assignee_name)}
                </div>
                <span className="truncate text-xs text-slate-500">{task.assignee_name.split(" ")[0]}</span>
              </div>
            ) : (
              <span />
            )}
            {task.due_date && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  overdue
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800",
                )}
              >
                {task.due_date}
              </span>
            )}
          </div>
          <TaskProvenance task={task} orgSlug={orgSlug} />
        </div>
      </div>
    </TbCard>
  );
}

function SortableTask({
  task,
  orgSlug,
  canDrag,
  onTaskClick,
}: {
  task: BoardTask;
  orgSlug?: string;
  canDrag: boolean;
  onTaskClick?: (task: BoardTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canDrag,
  });

  if (!canDrag) {
    return <TaskCard task={task} orgSlug={orgSlug} onClick={() => onTaskClick?.(task)} />;
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} orgSlug={orgSlug} draggable />
    </div>
  );
}

function QuickAdd({
  columnId,
  onAdd,
}: {
  columnId: string;
  onAdd: (title: string, status: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onAdd(title.trim(), columnId);
      setTitle("");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1 rounded-input py-2 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter une tâche
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la tâche"
        className="tb-input text-xs"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && void submit()}
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => void submit()} disabled={loading} className="tb-btn-primary h-8 text-xs">
          Ajouter
        </button>
        <button type="button" onClick={() => setOpen(false)} className="tb-btn-secondary h-8 text-xs">
          Annuler
        </button>
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  orgSlug,
  onStatusChange,
  onTaskCreated,
  canDrag = true,
  onTaskClick,
  canQuickAdd = true,
}: {
  tasks: BoardTask[];
  orgSlug?: string;
  onStatusChange: (taskId: string, status: string) => void;
  onTaskCreated?: () => void;
  canDrag?: boolean;
  onTaskClick?: (task: BoardTask) => void;
  canQuickAdd?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    if (!canDrag) return;
    setActiveId(null);
    const taskId = String(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;
    const col = COLUMNS.find((c) => c.id === overId);
    if (col) onStatusChange(taskId, col.id);
    else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) onStatusChange(taskId, overTask.status);
    }
  };

  async function quickAdd(title: string, status: string) {
    await apiClient.post("/api/tasks", { title, status });
    onTaskCreated?.();
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} id={col.id} className="rounded-card bg-slate-50 p-3 dark:bg-slate-900/50">
              <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-400">
                {col.label}
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">{colTasks.length}</span>
              </h3>
              <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="min-h-[120px] space-y-2">
                  {colTasks.map((task) => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      orgSlug={orgSlug}
                      canDrag={canDrag}
                      onTaskClick={onTaskClick}
                    />
                  ))}
                </div>
              </SortableContext>
              {canQuickAdd && (
                <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <QuickAdd columnId={col.id} onAdd={quickAdd} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} orgSlug={orgSlug} /> : null}</DragOverlay>
    </DndContext>
  );
}
