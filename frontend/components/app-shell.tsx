"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTranslation } from "@/app/lib/use-locale";
import { canManageOrg, isReadOnly } from "@/app/lib/permissions";
import { cn } from "@/app/lib/utils";
import { initials } from "@/components/ui/avatar";
import { AppFooter } from "@/components/marketing-shell";
import { AskAiPopup } from "@/components/ask-ai-popup";
import { NotificationBell } from "@/components/notification-bell";
import { LocaleThemeBar } from "@/components/locale-theme-bar";
import type { I18nKey } from "@/app/lib/i18n";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string | null;
  badge?: string;
  adminOnly?: boolean;
  alsoActive?: string[];
  matchTab?: string;
  excludeTab?: string;
};

function buildNavGroups(t: (key: I18nKey) => string): {
  id: string;
  label: string;
  items: NavItem[];
}[] {
  return [
    {
      id: "travail",
      label: t("navWork"),
      items: [
        { href: "dashboard", label: t("dashboard"), icon: Layers, module: null },
        { href: "tasks", label: t("navProjectsTasks"), icon: Zap, module: null, alsoActive: ["projects"] },
      ],
    },
    {
      id: "communication",
      label: t("navCommunication"),
      items: [
        { href: "assistant", label: t("navAiChat"), icon: MessageSquare, module: null, badge: t("badgeLive") },
        { href: "messages", label: t("navAnnouncements"), icon: Bell, module: "messages" },
        { href: "meetings", label: t("meetings"), icon: Mic, module: "meetings" },
      ],
    },
    {
      id: "intelligence",
      label: t("navIntelligence"),
      items: [
        { href: "memory", label: t("navCollectiveMemory"), icon: Brain, module: null },
        { href: "documents", label: t("navDocsLibrary"), icon: Folder, module: "documents" },
      ],
    },
    {
      id: "admin",
      label: t("navAdministration"),
      items: [
        {
          href: "settings?tab=team",
          label: t("navTeamMembers"),
          icon: Users,
          module: null,
          adminOnly: true,
          matchTab: "team",
        },
        {
          href: "settings",
          label: t("settings"),
          icon: Settings,
          module: null,
          adminOnly: true,
          excludeTab: "team",
        },
      ],
    },
  ];
}

function buildPageTitles(t: (key: I18nKey) => string): Record<string, string> {
  return {
    dashboard: t("dashboard"),
    tasks: t("navProjectsTasks"),
    projects: t("projects"),
    documents: t("navDocsLibrary"),
    messages: t("navAnnouncements"),
    calendar: t("calendar"),
    meetings: t("meetings"),
    memory: t("navCollectiveMemory"),
    assistant: t("navAiChat"),
    settings: t("settings"),
  };
}

function roleLabel(role: string | null | undefined, t: (key: I18nKey) => string) {
  const labels: Record<string, I18nKey> = {
    owner: "roleOwner",
    admin: "roleAdmin",
    manager: "roleManager",
    member: "roleMember",
    field_agent: "roleFieldAgent",
  };
  const key = labels[role ?? ""];
  return key ? t(key) : role ?? t("roleMember");
}

function TrialBanner() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const billing = user?.billing;
  if (!billing || billing.pricing_tier !== "free_trial") return null;
  if (billing.is_read_only) {
    return (
      <div className="border-b border-amber-300/50 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100">
        {t("trialEnded")}{" "}
        <Link href="/pricing" className="font-medium text-primary hover:underline">
          {t("trialUpgrade")}
        </Link>
      </div>
    );
  }
  const days = billing.trial_days_left ?? 30;
  return (
    <div className="border-b border-indigo-200/50 bg-indigo-50 px-4 py-2 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100">
      {t("trialFree")} : {days} {t("trialDaysLeft")}.{" "}
      <Link href="/pricing" className="font-medium underline">
        {t("trialPlans")}
      </Link>
    </div>
  );
}

function OrgSwitcher({ orgSlug }: { orgSlug: string }) {
  const { user, switchOrg } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const orgs = user?.organizations ?? [];
  const isAdmin = canManageOrg(user);
  const orgDisplay = (user?.org_name ?? orgSlug).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        id="org-switcher-btn"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-750 bg-slate-850 p-2.5 text-left transition-all duration-200 hover:bg-slate-800"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white shadow-sm">
            {orgDisplay.charAt(0)}
          </div>
          <h2 className="truncate text-sm font-bold tracking-wide text-slate-100">{orgDisplay}</h2>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-750 bg-slate-850 py-1 shadow-xl">
            {orgs.length > 1 && (
              <>
                <div className="border-b border-slate-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t("orgSwitcherTitle")}
                </div>
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (o.id !== user?.organization_id) void switchOrg(o.id);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-slate-800",
                      o.slug === orgSlug && "bg-slate-800/60",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-200">{o.name}</div>
                      <div className="truncate text-[10px] text-slate-400">{roleLabel(o.role, t)}</div>
                    </div>
                    {o.slug === orgSlug && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                  </button>
                ))}
              </>
            )}
            {isAdmin && (
              <Link
                href={`/${orgSlug}/settings`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 border-t border-slate-800 px-3 py-2.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Settings className="h-3.5 w-3.5" />
                {t("orgManage")}
              </Link>
            )}
            {!isAdmin && orgs.length <= 1 && (
              <p className="px-3 py-2 text-[10px] text-slate-500">{t("orgActive")}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-2 bg-slate-950/40 px-6 py-4">
      <div className="rounded-md border border-indigo-500/30 bg-indigo-600/20 p-1.5">
        <Brain className="h-5 w-5 animate-pulse text-indigo-400" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="bg-gradient-to-r from-indigo-400 to-amber-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          TeamBrain
        </span>
        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
          AI
        </span>
      </div>
    </div>
  );
}

function RoleModeBadge({ orgSlug }: { orgSlug: string }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = canManageOrg(user);
  const readOnly = isReadOnly(user);

  if (readOnly) {
    return (
      <span className="hidden items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-400 sm:inline-flex">
        {t("badgeReadOnly")}
      </span>
    );
  }

  if (isAdmin) {
    return (
      <Link
        href={`/${orgSlug}/settings`}
        className="hidden items-center gap-1.5 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold text-indigo-400 transition-colors hover:bg-indigo-500/20 sm:inline-flex"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
        {t("badgeAdminMode")}
      </Link>
    );
  }

  return (
    <span className="hidden items-center gap-1.5 rounded-md border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold text-slate-400 sm:inline-flex">
      {roleLabel(user?.role, t)}
    </span>
  );
}

function SidebarNav({
  orgSlug,
  pathname,
  settingsTab,
  enabledModules,
  collapsedGroups,
  toggleGroup,
  isAdmin,
  navGroups,
  onNavigate,
}: {
  orgSlug: string;
  pathname: string;
  settingsTab: string | null;
  enabledModules: string[];
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  isAdmin: boolean;
  navGroups: ReturnType<typeof buildNavGroups>;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => {
        if (group.id === "admin" && !isAdmin) return null;
        const items = group.items.filter(
          (item) => (!item.adminOnly || isAdmin) && (!item.module || enabledModules.includes(item.module)),
        );
        if (items.length === 0) return null;
        const collapsed = collapsedGroups[group.id];
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-200"
            >
              <span>{group.label}</span>
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {!collapsed && (
              <div className="mt-1.5 space-y-0.5">
                {items.map((item) => {
                  const baseHref = item.href.split("?")[0];
                  const path = `/${orgSlug}/${item.href}`;
                  const onBasePath =
                    pathname === `/${orgSlug}/${baseHref}` ||
                    pathname.startsWith(`/${orgSlug}/${baseHref}/`) ||
                    (item.alsoActive?.some((seg) => pathname.startsWith(`/${orgSlug}/${seg}`)) ?? false);
                  let active = onBasePath;
                  if (baseHref === "settings") {
                    if (item.matchTab) active = onBasePath && settingsTab === item.matchTab;
                    else if (item.excludeTab) active = onBasePath && settingsTab !== item.excludeTab;
                  }
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={path}
                      onClick={onNavigate}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                        active
                          ? "bg-indigo-600 font-semibold text-white shadow-xs shadow-indigo-600/25"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                            active ? "text-white" : "text-slate-400 group-hover:text-slate-200",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className="flex h-4 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/15 px-1.5 text-[9px] font-bold text-indigo-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const name = user?.full_name ?? "";
  const ini = initials(name);

  return (
    <div className="border-t border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-slate-700 bg-indigo-500/10 text-sm font-bold text-indigo-300">
            {ini}
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-200">{name}</div>
            <div className="flex items-center gap-1 truncate text-[10px] text-slate-400">
              <ShieldCheck className="h-3 w-3 shrink-0 text-indigo-400" />
              {roleLabel(user?.role, t)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          title={t("logout")}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SidebarPanel({
  orgSlug,
  pathname,
  settingsTab,
  enabledModules,
  collapsedGroups,
  toggleGroup,
  isAdmin,
  navGroups,
  onNavigate,
  onLogout,
  className,
}: {
  orgSlug: string;
  pathname: string;
  settingsTab: string | null;
  enabledModules: string[];
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  isAdmin: boolean;
  navGroups: ReturnType<typeof buildNavGroups>;
  onNavigate?: () => void;
  onLogout: () => void;
  className?: string;
}) {
  return (
    <aside className={cn("flex h-full w-72 flex-col border-r border-slate-800 bg-slate-900 text-slate-100", className)}>
      <div className="border-b border-slate-800 p-4">
        <OrgSwitcher orgSlug={orgSlug} />
      </div>
      <BrandHeader />
      <SidebarNav
        orgSlug={orgSlug}
        pathname={pathname}
        settingsTab={settingsTab}
        enabledModules={enabledModules}
        collapsedGroups={collapsedGroups}
        toggleGroup={toggleGroup}
        isAdmin={isAdmin}
        navGroups={navGroups}
        onNavigate={onNavigate}
      />
      <SidebarFooter onLogout={onLogout} />
    </aside>
  );
}

export function AppShell({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navGroups = useMemo(() => buildNavGroups(t), [t]);
  const pageTitles = useMemo(() => buildPageTitles(t), [t]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const settingsTab = searchParams.get("tab");

  const enabledModules = (user?.settings?.modules as string[] | undefined) ?? [
    "projects",
    "field-reports",
    "meetings",
    "documents",
    "calendar",
    "messages",
    "whatsapp",
  ];

  const currentSegment = pathname.split("/").pop()?.split("?")[0] ?? "dashboard";
  const pageTitle =
    currentSegment === "settings" && settingsTab === "team"
      ? t("navTeamMembers")
      : pageTitles[currentSegment] ?? currentSegment;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isAdmin = canManageOrg(user);

  function handleGlobalSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/${orgSlug}/assistant?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800 transition-colors duration-250 dark:bg-slate-900 dark:text-slate-100">
      <TrialBanner />
      <div className="flex flex-1 overflow-hidden">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        <div className="hidden lg:flex">
          <SidebarPanel
            orgSlug={orgSlug}
            pathname={pathname}
            settingsTab={settingsTab}
            enabledModules={enabledModules}
            collapsedGroups={collapsedGroups}
            toggleGroup={toggleGroup}
            isAdmin={isAdmin}
            navGroups={navGroups}
            onLogout={() => void logout()}
          />
        </div>

        {mobileOpen && (
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <SidebarPanel
              orgSlug={orgSlug}
              pathname={pathname}
              settingsTab={settingsTab}
              enabledModules={enabledModules}
              collapsedGroups={collapsedGroups}
              toggleGroup={toggleGroup}
              isAdmin={isAdmin}
              navGroups={navGroups}
              onNavigate={() => setMobileOpen(false)}
              onLogout={() => void logout()}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                aria-label={t("openMenu")}
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-lg lg:text-xl">
                {pageTitle}
              </h1>
            </div>

            <form onSubmit={handleGlobalSearch} className="mx-auto hidden w-full max-w-md md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchOrgPlaceholder")}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <RoleModeBadge orgSlug={orgSlug} />
              <NotificationBell orgSlug={orgSlug} />
              <LocaleThemeBar />
            </div>
          </header>

          <form onSubmit={handleGlobalSearch} className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchOrgPlaceholder")}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </form>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto h-full max-w-7xl">{children}</div>
            <AppFooter />
          </main>
        </div>
      </div>
      <AskAiPopup orgSlug={orgSlug} />
    </div>
  );
}
