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
import { Bot, Calendar, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/app/lib/utils";

export type KanbanTask = {
  id: string;
  title: string;
  priority?: string;
  assignee_name?: string;
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

function TaskProvenance({
  task,
  orgSlug,
}: {
  task: KanbanTask;
  orgSlug?: string;
}) {
  if (task.source === "meeting_ai" && task.source_reference && orgSlug) {
    return (
      <Link
        href={`/${orgSlug}/meetings?highlight=${task.source_reference}`}
        className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700/80 hover:text-amber-900 dark:text-amber-400/80"
        onClick={(e) => e.stopPropagation()}
      >
        <Bot className="h-3 w-3" />
        Créé par Meeting AI
      </Link>
    );
  }
  if (task.source === "meeting_ai") {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700/80 dark:text-amber-400/80">
        <Calendar className="h-3 w-3" />
        Créé par Meeting AI
      </p>
    );
  }
  if (task.source === "whatsapp") {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500">
        <MessageCircle className="h-3 w-3" />
        Créé via WhatsApp
      </p>
    );
  }
  return null;
}

function TaskCard({ task, orgSlug }: { task: KanbanTask; orgSlug?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <p className="text-sm font-medium">{task.title}</p>
      {task.assignee_name && (
        <p className="mt-1 text-xs text-stone-500">{task.assignee_name}</p>
      )}
      <TaskProvenance task={task} orgSlug={orgSlug} />
      {task.due_date && (
        <p className="mt-1 text-xs text-stone-400">Échéance: {task.due_date}</p>
      )}
    </div>
  );
}

function SortableTask({ task, orgSlug }: { task: KanbanTask; orgSlug?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} orgSlug={orgSlug} />
    </div>
  );
}

export function KanbanBoard({
  tasks,
  orgSlug,
  onStatusChange,
}: {
  tasks: KanbanTask[];
  orgSlug?: string;
  onStatusChange: (taskId: string, status: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
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

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              id={col.id}
              className="rounded-xl border border-stone-200 bg-stone-100/50 p-3 dark:border-stone-800 dark:bg-stone-900/50"
            >
              <h3 className="mb-3 text-sm font-semibold text-stone-600 dark:text-stone-400">
                {col.label} ({colTasks.length})
              </h3>
              <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 min-h-[120px]" id={col.id}>
                  {colTasks.map((task) => (
                    <SortableTask key={task.id} task={task} orgSlug={orgSlug} />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} orgSlug={orgSlug} /> : null}</DragOverlay>
    </DndContext>
  );
}
