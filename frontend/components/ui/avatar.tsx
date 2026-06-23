import { cn } from "@/app/lib/utils";

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-11 w-11 text-base" };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-primary dark:bg-indigo-950",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
