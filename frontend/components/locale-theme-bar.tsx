"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { type Locale, t as translate } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";

const LOCALE_KEY = "teambrain-ui-locale";

export function readUiLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LOCALE_KEY);
  return raw === "en" || raw === "fr" ? raw : null;
}

export function writeUiLocale(locale: Locale) {
  localStorage.setItem(LOCALE_KEY, locale);
  window.dispatchEvent(new CustomEvent("teambrain-locale", { detail: locale }));
}

export function LocaleThemeBar({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [locale, setLocale] = useState<Locale>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLocale(readUiLocale() ?? "fr");
    const onLocale = (e: Event) => {
      const detail = (e as CustomEvent<Locale>).detail;
      if (detail === "en" || detail === "fr") setLocale(detail);
    };
    window.addEventListener("teambrain-locale", onLocale);
    return () => window.removeEventListener("teambrain-locale", onLocale);
  }, []);

  if (!mounted) return <div className={cn("h-9 w-28", className)} />;

  return (
    <div className={cn("flex items-center gap-1 rounded-input border border-slate-200 p-0.5 dark:border-slate-700", className)}>
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => {
            writeUiLocale(code);
            setLocale(code);
          }}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors",
            locale === code
              ? "bg-primary text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
          )}
          aria-pressed={locale === code}
        >
          {code}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={theme === "dark" ? translate("lightMode", locale) : translate("darkMode", locale)}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
