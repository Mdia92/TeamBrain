import type { User } from "@/app/lib/api";

export type OrgRole = "owner" | "admin" | "manager" | "member" | "field_agent";

const ADMIN_ROLES: OrgRole[] = ["owner", "admin"];

export function userRole(user: User | null | undefined): OrgRole | null {
  const role = user?.role as OrgRole | undefined;
  return role ?? null;
}

export function isOrgAdmin(user: User | null | undefined): boolean {
  const role = userRole(user);
  return role !== null && ADMIN_ROLES.includes(role);
}

/** @deprecated Managers no longer have edit rights — use isOrgAdmin */
export function isManagerOrAbove(user: User | null | undefined): boolean {
  return isOrgAdmin(user);
}

export function canManageOrg(user: User | null | undefined): boolean {
  return isOrgAdmin(user);
}

export function isReadOnly(user: User | null | undefined): boolean {
  return user?.billing?.is_read_only === true;
}

/** Create projects, tasks, documents, meetings — admins only. */
export function canCreateContent(user: User | null | undefined): boolean {
  return !isReadOnly(user) && isOrgAdmin(user);
}

/** Edit, delete, drag board — admins only. */
export function canEditContent(user: User | null | undefined): boolean {
  return !isReadOnly(user) && isOrgAdmin(user);
}

/** Task drag-and-drop — admins only (members use « Marquer terminé »). */
export function canDragTasks(user: User | null | undefined): boolean {
  return canEditContent(user);
}

/** @deprecated Use canDragTasks */
export const canDragKanban = canDragTasks;

export function canCreateProject(user: User | null | undefined): boolean {
  return canEditContent(user);
}

/** Members may mark their own assigned tasks done. */
export function canCompleteTask(
  user: User | null | undefined,
  task: { assignee_id?: string | null; status: string },
): boolean {
  if (isReadOnly(user) || !user) return false;
  if (isOrgAdmin(user)) return task.status !== "done";
  if (!task.assignee_id) return false;
  return task.assignee_id === user.id && task.status !== "done";
}

export function memberApprovalHint(): string {
  return "Réservé aux administrateurs — vous pouvez marquer vos tâches assignées comme terminées";
}
