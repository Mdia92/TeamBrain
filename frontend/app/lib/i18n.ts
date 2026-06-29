export type Locale = "fr" | "en" | "wo";

const fr = {
  appName: "TeamBrain",
  tagline: "Plateforme TeamBrain pour organisations terrain",
  login: "Connexion",
  signup: "Inscription",
  logout: "Déconnexion",
  dashboard: "Tableau de bord",
  projects: "Projets",
  tasks: "Tâches",
  documents: "Documents",
  messages: "Messages",
  calendar: "Calendrier",
  fieldReports: "Rapports terrain",
  meetings: "Réunions",
  assistant: "Assistant IA",
  assistantBrand: "Xam",
  assistantHello: "Bonjour, je suis Xam.",
  assistantThinking: "Xam réfléchit…",
  assistantPageDescription:
    "Xam répond à partir de la mémoire de votre organisation — projets, tâches, calendrier et rapports.",
  assistantCalendarDescription:
    "Xam lit vos événements et échéances via la mémoire organisationnelle pour répondre avec des sources.",
  assistantCalendarInsights: "insights Xam",
  askAssistantButton: "Demander à Xam",
  assistantPolicyHelp:
    "Seuil minimal de pertinence mémoire pour qu'une source compte dans une réponse de l'assistant.",
  assistantPolicyJobs: "Les jobs de rappel et l'assistant utilisent ces seuils.",
  documentUploaded: "Document téléversé",
  uploadError: "Erreur de téléversement",
  dailyStatus: "Statut du jour",
  activeProjects: "Projets actifs",
  tasksThisWeek: "Tâches terminées cette semaine",
  overdueTasks: "Tâches en retard",
  fieldReportsWeek: "Rapports terrain cette semaine",
  upcomingDeadlines: "Échéances à venir",
  newProject: "Nouveau projet",
  newTask: "Nouvelle tâche",
  newReport: "Nouveau rapport",
  pendingSync: "rapports en attente de synchronisation",
  askAssistant: "Posez une question à l'assistant...",
  onboardingTitle: "Configurez votre espace",
  email: "Email",
  password: "Mot de passe",
  fullName: "Nom complet",
  organizationName: "Nom de l'organisation",
  continue: "Continuer",
  loading: "Chargement...",
  save: "Enregistrer",
  cancel: "Annuler",
  search: "Rechercher",
  upload: "Téléverser",
  offline: "Hors ligne",
  online: "En ligne",
} as const;

const en = {
  ...fr,
  tagline: "TeamBrain platform for field organizations",
  login: "Log in",
  signup: "Sign up",
  logout: "Log out",
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "Tasks",
  documents: "Documents",
  messages: "Messages",
  calendar: "Calendar",
  fieldReports: "Field reports",
  meetings: "Meetings",
  assistant: "Ask AI",
  assistantBrand: "Ask AI",
  assistantHello: "Hello, I'm Ask AI.",
  assistantThinking: "Ask AI is thinking…",
  assistantPageDescription:
    "Ask AI answers from your organization's memory — projects, tasks, calendar, and reports.",
  assistantCalendarDescription:
    "Ask AI reads your events and deadlines via organizational memory and cites its sources.",
  assistantCalendarInsights: "Ask AI insights",
  askAssistantButton: "Ask AI",
  assistantPolicyHelp:
    "Minimum memory relevance for a source to count in an assistant answer.",
  assistantPolicyJobs: "Reminder jobs and Ask AI use these thresholds.",
  documentUploaded: "Document uploaded",
  uploadError: "Upload failed",
  dailyStatus: "Daily status",
  activeProjects: "Active projects",
  tasksThisWeek: "Tasks completed this week",
  overdueTasks: "Overdue tasks",
  fieldReportsWeek: "Field reports this week",
  upcomingDeadlines: "Upcoming deadlines",
  newProject: "New project",
  newTask: "New task",
  newReport: "New report",
  pendingSync: "reports pending sync",
  askAssistant: "Ask a question…",
  onboardingTitle: "Set up your workspace",
  fullName: "Full name",
  organizationName: "Organization name",
  continue: "Continue",
  loading: "Loading...",
  save: "Save",
  cancel: "Cancel",
  search: "Search",
  upload: "Upload",
  offline: "Offline",
  online: "Online",
} as const;

const wo = {
  ...fr,
  assistantBrand: "Xam",
  assistantHello: "Nanga def, ma ngi Xam.",
  assistantThinking: "Xam dafa xalaat…",
  askAssistantButton: "Laaj Xam",
} as const;

export const locales: Record<Locale, Record<I18nKey, string>> = { fr, en, wo };

export type I18nKey = keyof typeof fr;

export function resolveLocale(raw?: string | null): Locale {
  if (raw === "en" || raw === "wo") return raw;
  return "fr";
}

export function t(key: I18nKey, locale: Locale = "fr"): string {
  return locales[locale][key] ?? locales.fr[key] ?? key;
}
