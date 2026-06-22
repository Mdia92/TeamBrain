"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Brain,
  Calendar,
  ChevronDown,
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
import { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";

const ALL_NAV = [
  { href: "dashboard", label: t("dashboard"), icon: LayoutDashboard, module: null },
  { href: "projects", label: t("projects"), icon: FolderKanban, module: "projects" },
  { href: "tasks", label: t("tasks"), icon: CheckSquare, module: "projects" },
  { href: "documents", label: t("documents"), icon: FileText, module: "documents" },
  { href: "messages", label: t("messages"), icon: MessageSquare, module: null },
  { href: "calendar", label: t("calendar"), icon: Calendar, module: "calendar" },
  { href: "daily-status", label: t("dailyStatus"), icon: ClipboardList, module: null },
  { href: "field-reports", label: t("fieldReports"), icon: MapPin, module: "field-reports" },
  { href: "meetings", label: t("meetings"), icon: Mic, module: "meetings" },
  { href: "memory", label: "Mémoire", icon: Brain, module: null },
  { href: "assistant", label: t("assistant"), icon: Bot, module: null },
];

function TrialBanner({ orgSlug }: { orgSlug: string }) {
  const { user } = useAuth();
  const billing = user?.billing;
  if (!billing || billing.pricing_tier !== "free_trial") return null;
  if (billing.is_read_only) {
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        Essai gratuit expiré — mode lecture seule.{" "}
        <Link href="/pricing" className="font-medium underline">
          Voir les forfaits
        </Link>
      </div>
    );
  }
  const days = billing.trial_days_left ?? 30;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
      Essai gratuit : {days} jour{days !== 1 ? "s" : ""} restant{days !== 1 ? "s" : ""}.{" "}
      <Link href="/pricing" className="font-medium underline">
        Forfaits
      </Link>
    </div>
  );
}

function OrgSwitcher({ orgSlug }: { orgSlug: string }) {
  const { user, switchOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const orgs = user?.organizations ?? [];
  if (orgs.length <= 1) {
    return <p className="truncate font-semibold">{user?.org_name ?? orgSlug}</p>;
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-1 font-semibold"
      >
        <span className="truncate">{user?.org_name ?? orgSlug}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-800">
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setOpen(false);
                if (o.id !== user?.organization_id) void switchOrg(o.id);
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700",
                o.slug === orgSlug && "bg-amber-50 dark:bg-amber-950",
              )}
            >
              {o.name}
              <span className="ml-1 text-xs text-stone-400">({o.role})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const enabledModules = (user?.settings?.modules as string[] | undefined) ?? [
    "projects",
    "field-reports",
    "meetings",
    "documents",
    "calendar",
    "whatsapp",
  ];
  const navItems = ALL_NAV.filter(
    (item) => !item.module || enabledModules.includes(item.module),
  );

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <TrialBanner orgSlug={orgSlug} />
      <div className="flex flex-1">
        <aside className="flex w-60 flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div className="border-b border-stone-200 p-4 dark:border-stone-800">
            <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {t("appName")}
            </p>
            <OrgSwitcher orgSlug={orgSlug} />
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
            <Link
              href={`/${orgSlug}/settings`}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Paramètres
            </Link>
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
    </div>
  );
}
