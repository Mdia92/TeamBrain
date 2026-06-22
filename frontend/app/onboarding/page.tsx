"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";

export default function OnboardingPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.onboarding_completed && user.org_slug) {
      router.replace(`/${user.org_slug}/dashboard`);
      return;
    }
    if (params.get("done") === "1") {
      void refreshUser().then((u) => {
        if (u?.org_slug) router.replace(`/${u.org_slug}/dashboard`);
      });
    } else {
      router.replace("/create");
    }
  }, [user, isLoading, router, params, refreshUser]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-stone-500">{t("loading")}</p>
    </div>
  );
}
