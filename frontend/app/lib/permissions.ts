import type { User } from "@/app/lib/api";

export type OrgRole = "owner" | "admin" | "manager" | "member" | "field_agent";

const ADMIN_ROLES: OrgRole[] = ["owner", "admin"];
const MANAGER_PLUS: OrgRole[] = ["owner", "admin", "manager"];

export function userRole(user: User | null | undefined): OrgRole | null {
  const role = user?.role as OrgRole | undefined;
  return role ?? null;
}

export function isOrgAdmin(user: User | null | undefined): boolean {
  const role = userRole(user);
  return role !== null && ADMIN_ROLES.includes(role);
}

export function isManagerOrAbove(user: User | null | undefined): boolean {
  const role = userRole(user);
  return role !== null && MANAGER_PLUS.includes(role);
}

export function canManageOrg(user: User | null | undefined): boolean {
  return isOrgAdmin(user);
}

export function isReadOnly(user: User | null | undefined): boolean {
  return user?.billing?.is_read_only === true;
}

/** Create / submit content (tasks, reports, messages to individuals). */
export function canCreateContent(user: User | null | undefined): boolean {
  return !isReadOnly(user);
}

/** Edit, drag task board, delete, upload meetings — managers and admins. */
export function canEditContent(user: User | null | undefined): boolean {
  return !isReadOnly(user) && isManagerOrAbove(user);
}

/** Task drag-and-drop status changes. */
export function canDragTasks(user: User | null | undefined): boolean {
  return canEditContent(user);
}

/** @deprecated Use canDragTasks */
export const canDragKanban = canDragTasks;

/** Create projects — managers and admins only. */
export function canCreateProject(user: User | null | undefined): boolean {
  return !isReadOnly(user) && isManagerOrAbove(user);
}

/** Members may mark their own assigned tasks done; managers can change any task. */
export function canCompleteTask(
  user: User | null | undefined,
  task: { assignee_id?: string | null; status: string },
): boolean {
  if (isReadOnly(user) || !user) return false;
  if (isManagerOrAbove(user)) return task.status !== "done";
  if (!task.assignee_id) return false;
  return task.assignee_id === user.id && task.status !== "done";
}

/** Members see this instead of destructive / admin-only controls. */
export function memberApprovalHint(): string {
  return "Demander l'approbation à un administrateur";
}
