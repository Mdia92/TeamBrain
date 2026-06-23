"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Brain,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  MoreHorizontal,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, type BreadcrumbItem } from "@/components/ui/page-header";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string | null;
};

const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: "work",
    label: "Travail",
    items: [
      { href: "dashboard", label: t("dashboard"), icon: LayoutDashboard, module: null },
      { href: "projects", label: t("projects"), icon: FolderKanban, module: "projects" },
      { href: "tasks", label: t("tasks"), icon: CheckSquare, module: "projects" },
      { href: "documents", label: t("documents"), icon: FileText, module: "documents" },
      { href: "field-reports", label: t("fieldReports"), icon: MapPin, module: "field-reports" },
      { href: "calendar", label: t("calendar"), icon: Calendar, module: "calendar" },
      { href: "daily-status", label: t("dailyStatus"), icon: ClipboardList, module: null },
    ],
  },
  {
    id: "comm",
    label: "Communication",
    items: [
      { href: "messages", label: t("messages"), icon: MessageSquare, module: null },
      { href: "meetings", label: t("meetings"), icon: Mic, module: "meetings" },
    ],
  },
  {
    id: "intel",
    label: "Intelligence",
    items: [
      { href: "memory", label: "Mémoire", icon: Brain, module: null },
      { href: "assistant", label: t("assistant"), icon: Bot, module: null },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [{ href: "settings", label: "Paramètres", icon: Settings, module: null }],
  },
];

const MOBILE_TABS = [
  { href: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
  { href: "projects", label: t("projects"), icon: FolderKanban },
  { href: "messages", label: t("messages"), icon: MessageSquare },
  { href: "assistant", label: t("assistant"), icon: Bot },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: t("dashboard"),
  projects: t("projects"),
  tasks: t("tasks"),
  documents: t("documents"),
  messages: t("messages"),
  calendar: t("calendar"),
  "daily-status": t("dailyStatus"),
  "field-reports": t("fieldReports"),
  meetings: t("meetings"),
  memory: "Mémoire",
  assistant: t("assistant"),
  settings: "Paramètres",
};

function TrialBanner() {
  const { user } = useAuth();
  const billing = user?.billing;
  if (!billing || billing.pricing_tier !== "free_trial") return null;
  if (billing.is_read_only) {
    return (
      <div className="border-b border-amber-300/50 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100">
        Votre essai est terminé — mode lecture seule.{" "}
        <Link href="/pricing" className="font-medium text-primary hover:underline">
          Voir les forfaits
        </Link>
      </div>
    );
  }
  const days = billing.trial_days_left ?? 30;
  return (
    <div className="border-b border-indigo-200/50 bg-indigo-50 px-4 py-2 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100">
      Essai gratuit : {days} jour{days !== 1 ? "s" : ""} restant{days !== 1 ? "s" : ""}.{" "}
      <Link href="/pricing" className="font-medium underline">
        Forfaits
      </Link>
    </div>
  );
}

function OrgSwitcher({ orgSlug, compact }: { orgSlug: string; compact?: boolean }) {
  const { user, switchOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const orgs = user?.organizations ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-input text-left transition-colors duration-150 hover:bg-slate-800",
          compact ? "p-2" : "p-2.5",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
          {(user?.org_name ?? orgSlug).slice(0, 1).toUpperCase()}
        </div>
        {!compact && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.org_name ?? orgSlug}</p>
              <p className="truncate text-xs text-slate-400">{t("appName")}</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </>
        )}
      </button>
      {open && orgs.length > 1 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 animate-slide-up rounded-card border border-slate-700 bg-slate-800 py-1 shadow-dropdown">
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setOpen(false);
                if (o.id !== user?.organization_id) void switchOrg(o.id);
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700",
                o.slug === orgSlug && "bg-indigo-600/20 text-white",
              )}
            >
              {o.name}
              <span className="ml-1 text-xs text-slate-400">({o.role})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarNav({
  orgSlug,
  pathname,
  enabledModules,
  collapsedGroups,
  toggleGroup,
}: {
  orgSlug: string;
  pathname: string;
  enabledModules: string[];
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
}) {
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.module || enabledModules.includes(item.module));
        if (items.length === 0) return null;
        const collapsed = collapsedGroups[group.id];
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors duration-100 hover:text-slate-300"
            >
              {group.label}
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-90")} />
            </button>
            {!collapsed && (
              <ul className="mt-1 space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const path = `/${orgSlug}/${href}`;
                  const active = pathname === path || pathname.startsWith(`${path}/`);
                  return (
                    <li key={href}>
                      <Link
                        href={path}
                        className={cn(
                          "flex items-center gap-2.5 rounded-input px-2.5 py-2 text-sm transition-colors duration-150",
                          active
                            ? "bg-primary/20 font-medium text-white"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-input p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Avatar name={user?.full_name} size="sm" />
        <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 md:inline">
          {user?.full_name?.split(" ")[0]}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-50 mt-2 w-52 animate-slide-up rounded-modal border border-slate-200 bg-white py-1 shadow-dropdown dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-sm font-medium">{user?.full_name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        </>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const enabledModules = (user?.settings?.modules as string[] | undefined) ?? [
    "projects",
    "field-reports",
    "meetings",
    "documents",
    "calendar",
    "whatsapp",
  ];

  const currentSegment = pathname.split("/").pop() ?? "dashboard";
  const pageTitle = PAGE_TITLES[currentSegment] ?? currentSegment;

  const breadcrumbs: BreadcrumbItem[] = useMemo(
    () => [
      { label: user?.org_name ?? orgSlug, href: `/${orgSlug}/dashboard` },
      ...(currentSegment !== "dashboard" ? [{ label: pageTitle }] : [{ label: t("dashboard") }]),
    ],
    [user?.org_name, orgSlug, currentSegment, pageTitle],
  );

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TrialBanner />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col bg-sidebar md:flex">
          <div className="border-b border-slate-800 p-3">
            <OrgSwitcher orgSlug={orgSlug} />
          </div>
          <SidebarNav
            orgSlug={orgSlug}
            pathname={pathname}
            enabledModules={enabledModules}
            collapsedGroups={collapsedGroups}
            toggleGroup={toggleGroup}
          />
          <div className="border-t border-slate-800 p-3">
            <div className="flex items-center gap-2 rounded-input p-2">
              <Avatar name={user?.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
                <p className="truncate text-xs capitalize text-slate-400">{user?.role}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar animate-slide-in-right md:hidden">
              <div className="flex items-center justify-between border-b border-slate-800 p-3">
                <OrgSwitcher orgSlug={orgSlug} />
                <button type="button" onClick={() => setMobileOpen(false)} className="text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav
                orgSlug={orgSlug}
                pathname={pathname}
                enabledModules={enabledModules}
                collapsedGroups={collapsedGroups}
                toggleGroup={toggleGroup}
              />
            </aside>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              className="rounded-input p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setMobileOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 md:text-base">{pageTitle}</h2>
            <div className="mx-auto hidden max-w-md flex-1 md:flex">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="tb-input h-9 pl-9"
                />
              </div>
            </div>
            <button
              type="button"
              className="rounded-input p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <UserMenu onLogout={() => void logout()} />
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] dark:bg-slate-950 md:pb-6">
            <div className="mx-auto max-w-6xl animate-fade-in px-4 py-6 sm:px-6">
              {currentSegment !== "dashboard" && (
                <PageHeader title={pageTitle} breadcrumbs={breadcrumbs} className="md:hidden" />
              )}
              {children}
            </div>
          </main>

          {/* Mobile bottom tabs */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] md:hidden dark:border-slate-800 dark:bg-slate-950">
            {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
              const path = `/${orgSlug}/${href}`;
              const active = pathname === path || pathname.startsWith(`${path}/`);
              return (
                <Link
                  key={href}
                  href={path}
                  className={cn(
                    "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors",
                    active ? "text-primary" : "text-slate-500",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px]",
                moreOpen ? "text-primary" : "text-slate-500",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              Plus
            </button>
          </nav>

          {moreOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMoreOpen(false)} />
              <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 max-h-[min(16rem,50vh)] overflow-y-auto rounded-t-modal border border-slate-200 bg-white p-4 shadow-dropdown animate-slide-up md:hidden dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Navigation</p>
                <div className="grid grid-cols-2 gap-2">
                  {NAV_GROUPS.flatMap((g) => g.items)
                    .filter((item) => !item.module || enabledModules.includes(item.module))
                    .filter((item) => !MOBILE_TABS.some((t) => t.href === item.href))
                    .map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={`/${orgSlug}/${href}`}
                        className="flex items-center gap-2 rounded-input px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Icon className="h-4 w-4 text-primary" />
                        {label}
                      </Link>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
