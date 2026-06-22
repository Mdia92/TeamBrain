"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { AppShell } from "@/components/app-shell";

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
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
    if (user.org_slug && params.orgSlug !== user.org_slug) {
      router.replace(`/${user.org_slug}/dashboard`);
    }
  }, [user, isLoading, router, params.orgSlug]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-500">Chargement...</p>
      </div>
    );
  }

  if (user.org_slug && params.orgSlug !== user.org_slug) {
    return null;
  }

  return <AppShell orgSlug={params.orgSlug}>{children}</AppShell>;
}
