"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { type I18nKey, type Locale, resolveLocale, t as translate } from "@/app/lib/i18n";

export function useLocale(): Locale {
  const { user } = useAuth();
  const settings = user?.settings as { primary_language?: string } | undefined;
  return resolveLocale(settings?.primary_language);
}

export function useTranslation() {
  const locale = useLocale();
  const t = useCallback((key: I18nKey) => translate(key, locale), [locale]);
  return useMemo(() => ({ locale, t }), [locale, t]);
}
