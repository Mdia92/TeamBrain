"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Calendar,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Mic,
  Moon,
  Sun,
  FolderKanban,
  CheckSquare,
  ClipboardList,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";

const navItems = [
  { href: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
  { href: "projects", label: t("projects"), icon: FolderKanban },
  { href: "tasks", label: t("tasks"), icon: CheckSquare },
  { href: "documents", label: t("documents"), icon: FileText },
  { href: "messages", label: t("messages"), icon: MessageSquare },
  { href: "calendar", label: t("calendar"), icon: Calendar },
  { href: "daily-status", label: t("dailyStatus"), icon: ClipboardList },
  { href: "field-reports", label: t("fieldReports"), icon: MapPin },
  { href: "meetings", label: t("meetings"), icon: Mic },
  { href: "assistant", label: t("assistant"), icon: Bot },
];

export function AppShell({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <aside className="flex w-60 flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="border-b border-stone-200 p-4 dark:border-stone-800">
          <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {t("appName")}
          </p>
          <p className="truncate font-semibold">{user?.org_name ?? orgSlug}</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const path = `/${orgSlug}/${href}`;
            const active = pathname === path || pathname.startsWith(`${path}/`);
            return (
              <Link
                key={href}
                href={path}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                    : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-stone-200 p-2 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Mode clair" : "Mode sombre"}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
