"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";

export default function HomePage() {
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
    router.replace(`/${user.org_slug ?? "app"}/dashboard`);
  }, [user, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-stone-500">Chargement...</p>
    </div>
  );
}
