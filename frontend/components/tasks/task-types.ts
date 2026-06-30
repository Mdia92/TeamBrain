export type ExecutionTask = {
  id: string;
  title: string;
  status: string;
  project_id?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  due_date?: string | null;
  priority?: string;
  source?: string;
};

export type ExecutionProject = {
  id: string;
  name: string;
  description?: string | null;
  client_name?: string | null;
  status: string;
};

export type StatusFilter = "all" | "todo" | "in_progress" | "done";

export function computeProgress(tasks: ExecutionTask[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

export function matchesStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "done") return status === "done";
  if (filter === "in_progress") return status === "in_progress" || status === "review";
  if (filter === "todo") return status === "todo" || status === "blocked";
  return true;
}
