"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { readUiLocale } from "@/components/locale-theme-bar";
import { type I18nKey, type Locale, resolveLocale, t as translate } from "@/app/lib/i18n";

export function useLocale(): Locale {
  const { user } = useAuth();
  const settings = user?.settings as { primary_language?: string } | undefined;
  const [override, setOverride] = useState<Locale | null>(null);

  useEffect(() => {
    setOverride(readUiLocale());
    const onLocale = (e: Event) => {
      const detail = (e as CustomEvent<Locale>).detail;
      if (detail === "en" || detail === "fr") setOverride(detail);
    };
    window.addEventListener("teambrain-locale", onLocale);
    return () => window.removeEventListener("teambrain-locale", onLocale);
  }, []);

  return override ?? resolveLocale(settings?.primary_language);
}

export function useTranslation() {
  const locale = useLocale();
  const t = useCallback((key: I18nKey) => translate(key, locale), [locale]);
  return useMemo(() => ({ locale, t }), [locale, t]);
}
