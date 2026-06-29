export type Locale = "fr" | "en" | "wo";

const fr = {
  appName: "Team Brain Ai",
  tagline: "Plateforme Team Brain Ai pour organisations terrain",
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
  assistant: "Ask AI",
  assistantBrand: "Ask AI",
  assistantHello: "Bonjour, je suis Ask AI.",
  assistantThinking: "Ask AI réfléchit…",
  assistantPageDescription:
    "Ask AI répond à partir de la mémoire de votre organisation — projets, tâches, calendrier et rapports.",
  assistantCalendarDescription:
    "Ask AI lit vos événements et échéances via la mémoire organisationnelle pour répondre avec des sources.",
  assistantCalendarInsights: "insights Ask AI",
  askAssistantButton: "Ask AI",
  assistantPopupHint: "La conversation continue sur la page Ask AI.",
  assistantPolicyHelp:
    "Seuil minimal de pertinence mémoire pour qu'une source compte dans une réponse Ask AI.",
  assistantPolicyJobs: "Les jobs de rappel et Ask AI utilisent ces seuils.",
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
  askAssistant: "Posez une question à Ask AI…",
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
  delete: "Supprimer",
  deleteConfirm: "Supprimer définitivement",
  deleteConfirmGeneric: "Supprimer cet élément ?",
  deleted: "Supprimé",
  deleteError: "Erreur lors de la suppression",
  lightMode: "Mode clair",
  darkMode: "Mode sombre",
  memoryTitle: "Mémoire organisationnelle",
  memoryDescription:
    "Le cerveau central de Team Brain Ai — chaque action dans les modules alimente cette mémoire.",
  tasksEmpty: "Aucune tâche",
  tasksEmptyHint: "Ajoutez une tâche directement — un projet est optionnel.",
  taskBoardDragHint: "Glissez-déposez les tâches entre les colonnes.",
  taskBoardViewHint: "Consultez les tâches — le déplacement est réservé aux managers.",
} as const;

const en = {
  ...fr,
  tagline: "Team Brain Ai platform for field organizations",
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
  assistantPopupHint: "The conversation continues on the Ask AI page.",
  assistantPolicyHelp:
    "Minimum memory relevance for a source to count in an Ask AI answer.",
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
  askAssistant: "Ask Ask AI a question…",
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
  delete: "Delete",
  deleteConfirm: "Permanently delete",
  deleteConfirmGeneric: "Delete this item?",
  deleted: "Deleted",
  deleteError: "Delete failed",
  lightMode: "Light mode",
  darkMode: "Dark mode",
  memoryTitle: "Organizational memory",
  memoryDescription:
    "The central brain of Team Brain Ai — every module action feeds this memory.",
  tasksEmpty: "No tasks yet",
  tasksEmptyHint: "Add a task directly — a project is optional.",
  taskBoardDragHint: "Drag tasks between columns.",
  taskBoardViewHint: "View tasks — moving cards is for managers.",
} as const;

/** Wolof strings — placeholder only, not exposed in the app UI yet. */
const wo = {
  ...fr,
  assistantBrand: "Ask AI",
} as const;

export const locales: Record<Locale, Record<I18nKey, string>> = { fr, en, wo };

export type I18nKey = keyof typeof fr;

export function resolveLocale(raw?: string | null): Locale {
  if (raw === "en") return "en";
  if (raw === "wo") return "fr";
  return "fr";
}

export function t(key: I18nKey, locale: Locale = "fr"): string {
  return locales[locale][key] ?? locales.fr[key] ?? key;
}
