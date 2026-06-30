import type { Locale } from "@/app/lib/i18n";

export function localeTag(locale: Locale): string {
  return locale === "en" ? "en-US" : "fr-FR";
}

export function formatDate(
  raw: string | Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = raw instanceof Date ? raw : new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return typeof raw === "string" ? raw : "";
  return d.toLocaleDateString(localeTag(locale), options ?? { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(raw: string | Date, locale: Locale): string {
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return typeof raw === "string" ? raw : "";
  return d.toLocaleString(localeTag(locale));
}

export function formatRelativeTime(iso: string, locale: Locale): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (locale === "en") {
    if (mins < 60) return `${mins || 1} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${days} d ago`;
  }
  if (mins < 60) return `il y a ${mins || 1} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}
