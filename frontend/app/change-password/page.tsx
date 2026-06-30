"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { postAuthPath } from "@/app/lib/auth-routes";
import { useTranslation } from "@/app/lib/use-locale";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { AuthCard } from "@/components/marketing-shell";

export default function ChangePasswordPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const forced = Boolean(user?.must_change_password);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.must_change_password) {
      router.replace(postAuthPath(user));
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-500">{t("loading")}</p>
      </div>
    );
  }

  return (
    <AuthCard
      title={t("changePasswordTitle")}
      subtitle={t("changePasswordForcedSubtitle")}
      footer={null}
    >
      <ChangePasswordForm
        forced={forced}
        onSuccess={async () => {
          const profile = await refreshUser();
          if (profile) router.replace(postAuthPath(profile));
        }}
      />
    </AuthCard>
  );
}
