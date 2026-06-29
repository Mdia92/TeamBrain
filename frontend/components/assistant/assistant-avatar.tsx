"use client";

import { Brain } from "lucide-react";
import { useTranslation } from "@/app/lib/use-locale";
import { cn } from "@/app/lib/utils";

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary",
        className,
      )}
      aria-hidden
    >
      <Brain className="h-4 w-4" />
    </span>
  );
}

export function AssistantLabel({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn("text-xs font-semibold text-primary", className)}>
      {t("assistantBrand")}
    </span>
  );
}
