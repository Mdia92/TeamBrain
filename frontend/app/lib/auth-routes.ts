import type { User } from "@/app/lib/api";

/** Post-login/signup destination respecting password change and onboarding. */
export function postAuthPath(user: Pick<User, "must_change_password" | "onboarding_completed" | "org_slug">): string {
  if (user.must_change_password) return "/change-password";
  if (!user.onboarding_completed) return "/onboarding";
  if (user.org_slug) return `/${user.org_slug}/dashboard`;
  return "/";
}
