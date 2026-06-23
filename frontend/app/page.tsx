"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { LandingPage } from "@/components/landing/landing-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      if (!user.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }
      router.replace(`/${user.org_slug ?? "app"}/dashboard`);
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0F172A]">
        <Skeleton className="h-10 w-48 bg-slate-800" />
        <Skeleton className="h-4 w-64 bg-slate-800" />
      </div>
    );
  }

  return <LandingPage />;
}
