/** Org-specific terminology from onboarding industry preset. */

export type TerminologyKey = "field_agent" | "field_report" | "subject" | "work_unit";

const DEFAULT_TERMS: Record<TerminologyKey, string> = {
  field_agent: "Agent terrain",
  field_report: "Rapport terrain",
  subject: "Bénéficiaire",
  work_unit: "Projet",
};

export const INDUSTRY_MODULE_PRESETS: Record<string, string[]> = {
  ngo: ["projects", "field-reports", "meetings", "documents", "calendar", "whatsapp"],
  tech: ["projects", "documents", "meetings", "calendar", "messages"],
  education: ["projects", "documents", "calendar", "messages"],
  health: ["projects", "documents", "meetings", "calendar"],
  commerce: ["projects", "documents", "calendar", "whatsapp"],
  agriculture: ["projects", "field-reports", "documents", "calendar", "whatsapp"],
  other: ["projects", "field-reports", "meetings", "documents", "calendar", "whatsapp", "messages"],
};

export const INDUSTRY_TERMINOLOGY: Record<string, Record<TerminologyKey, string>> = {
  ngo: {
    field_agent: "Agent terrain",
    field_report: "Rapport terrain",
    subject: "Bénéficiaire",
    work_unit: "Projet",
  },
  tech: {
    field_agent: "Développeur",
    field_report: "Sprint",
    subject: "Release",
    work_unit: "Sprint",
  },
  education: {
    field_agent: "Enseignant",
    field_report: "Cours",
    subject: "Élève",
    work_unit: "Cours",
  },
  health: {
    field_agent: "Praticien",
    field_report: "Consultation",
    subject: "Patient",
    work_unit: "Consultation",
  },
  commerce: {
    field_agent: "Vendeur",
    field_report: "Commande",
    subject: "Client",
    work_unit: "Commande",
  },
  agriculture: {
    field_agent: "Technicien",
    field_report: "Parcelle",
    subject: "Récolte",
    work_unit: "Parcelle",
  },
  other: DEFAULT_TERMS,
};

export function getOrgTerm(
  settings: Record<string, unknown> | undefined,
  key: TerminologyKey,
): string {
  const terminology = settings?.terminology as Record<string, string> | undefined;
  if (terminology?.[key]) return terminology[key];
  const industry = (settings?.industry as string) ?? "other";
  return INDUSTRY_TERMINOLOGY[industry]?.[key] ?? DEFAULT_TERMS[key];
}

export function getTeamSizePreset(teamSize: string | undefined): "simple" | "standard" | "full" {
  if (!teamSize || teamSize === "1-10") return "simple";
  if (teamSize === "11-50") return "standard";
  return "full";
}

export function modulesForIndustry(industry: string): string[] {
  return INDUSTRY_MODULE_PRESETS[industry] ?? INDUSTRY_MODULE_PRESETS.other;
}
