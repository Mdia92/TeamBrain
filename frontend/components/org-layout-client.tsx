"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { AppShell } from "@/components/app-shell";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export function OrgLayoutClient({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.onboarding_completed) {
      router.replace("/onboarding");
      return;
    }
    if (user.org_slug && orgSlug !== user.org_slug) {
      router.replace(`/${user.org_slug}/dashboard`);
    }
  }, [user, isLoading, router, orgSlug]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-white p-6 dark:bg-slate-950">
        <DashboardSkeleton />
      </div>
    );
  }

  if (user.org_slug && orgSlug !== user.org_slug) {
    return null;
  }

  return <AppShell orgSlug={orgSlug}>{children}</AppShell>;
}
