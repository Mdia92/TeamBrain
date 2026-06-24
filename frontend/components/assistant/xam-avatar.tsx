import { Brain } from "lucide-react";
import { cn } from "@/app/lib/utils";

export const ASSISTANT_NAME = "Xam";

export function XamAvatar({ className }: { className?: string }) {
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

export function XamLabel({ className }: { className?: string }) {
  return (
    <span className={cn("text-xs font-semibold text-primary", className)}>
      {ASSISTANT_NAME}
    </span>
  );
}
