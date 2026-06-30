"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, KeyboardEvent } from "react";
import { postAuthPath } from "@/app/lib/auth-routes";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import * as authApi from "@/app/lib/auth-api";
import { MarketingFooter } from "@/components/marketing-shell";
import { INDUSTRY_TERMINOLOGY, modulesForIndustry } from "@/app/lib/org-terminology";
import { InviteCodeForm } from "@/components/invite-code-form";

const INDUSTRIES = [
  { value: "ngo", label: "ONG" },
  { value: "tech", label: "Tech" },
  { value: "education", label: "Éducation" },
  { value: "health", label: "Santé" },
  { value: "agriculture", label: "Agriculture" },
  { value: "commerce", label: "Commerce" },
  { value: "other", label: "Autre" },
];

const TEAM_SIZES = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "200+", label: "200+" },
];

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "wo", label: "Wolof" },
];

const MODULES = [
  { id: "projects", label: "Projets" },
  { id: "field-reports", label: "Terrain" },
  { id: "meetings", label: "Réunions" },
  { id: "documents", label: "Documents" },
  { id: "calendar", label: "Calendrier" },
  { id: "messages", label: "Messages" },
  { id: "whatsapp", label: "WhatsApp" },
];

const ROLES = [
  { value: "admin", label: "Admin", description: "Gère l'espace et approuve les actions" },
  { value: "manager", label: "Manager", description: "Supervise les projets" },
  { value: "member", label: "Membre", description: "Contribue aux tâches" },
  { value: "field_agent", label: "Agent terrain", description: "Soumet rapports et photos depuis le terrain" },
];

type InviteRow = { email: string; role: string };

export default function CreateOrgPage() {
  const { user, signup, refreshUser, applySession } = useAuth();
  const router = useRouter();
  const isLoggedIn = Boolean(user);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgGoals, setOrgGoals] = useState("");
  const [industry, setIndustry] = useState("ngo");
  const [teamSize, setTeamSize] = useState("1-10");
  const [language, setLanguage] = useState("fr");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [modules, setModules] = useState<string[]>(modulesForIndustry("ngo"));

  useEffect(() => {
    setModules(modulesForIndustry(industry));
  }, [industry]);

  async function handleFinish(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const validInvites = invites.filter((i) => i.email.includes("@"));
      if (isLoggedIn) {
        if (!user?.onboarding_completed) {
          await authApi.completeOnboarding({
            organization_name: orgName,
            org_description: orgDescription,
            org_goals: orgGoals,
            industry,
            team_size: teamSize,
            primary_language: language,
            modules,
            invites: validInvites,
          });
          const profile = await refreshUser();
          if (profile) router.push(postAuthPath(profile));
        } else {
          const result = await authApi.createOrg({
            organization_name: orgName,
            industry,
            team_size: teamSize,
            primary_language: language,
            modules,
            invites: validInvites,
          });
          applySession(result);
          const profile = await refreshUser();
          if (profile) router.push(postAuthPath(profile));
        }
      } else {
        if (password !== passwordConfirm) {
          setError("Les mots de passe ne correspondent pas");
          setLoading(false);
          return;
        }
        await signup({
          organization_name: orgName,
          full_name: fullName,
          email,
          password,
          password_confirm: passwordConfirm,
          industry,
          team_size: teamSize,
          primary_language: language,
          inviteCode: inviteCode!,
        });
        await authApi.completeOnboarding({
          organization_name: orgName,
          org_description: orgDescription,
          org_goals: orgGoals,
          industry,
          team_size: teamSize,
          primary_language: language,
          modules,
          invites: validInvites,
        });
        const profile = await refreshUser();
        if (profile) router.push(postAuthPath(profile));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(id: string) {
    setModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function addInviteChip() {
    const chipEmail = inviteEmail.trim().toLowerCase();
    if (!chipEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chipEmail)) {
      setError("Email invalide");
      return;
    }
    if (isLoggedIn && user?.email && chipEmail === user.email.toLowerCase()) {
      setError("Vous êtes déjà membre — inutile de vous inviter vous-même");
      return;
    }
    if (!isLoggedIn && chipEmail === email.trim().toLowerCase()) {
      setError("Cet email est celui du compte admin — pas besoin de s'inviter");
      return;
    }
    if (invites.some((i) => i.email === chipEmail)) {
      setError("Cet email est déjà dans la liste");
      return;
    }
    setError("");
    setInvites([...invites, { email: chipEmail, role: inviteRole }]);
    setInviteEmail("");
  }

  function onInviteKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addInviteChip();
    }
  }

  const terms = INDUSTRY_TERMINOLOGY[industry] ?? INDUSTRY_TERMINOLOGY.other;
  const steps = isLoggedIn
    ? ["Organisation", "Inviter l'équipe", "Modules"]
    : ["Organisation", "Compte admin", "Inviter l'équipe", "Modules"];

  const lastStep = steps.length - 1;
  const adminStep = isLoggedIn ? -1 : 1;
  const inviteStep = isLoggedIn ? 1 : 2;
  const modulesStep = isLoggedIn ? 2 : 3;

  if (!isLoggedIn && !inviteCode) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-modal border border-slate-200 bg-white p-8 shadow-dropdown dark:border-slate-800 dark:bg-slate-900">
            <h1 className="mb-2 text-2xl font-bold">Code d&apos;invitation</h1>
            <p className="mb-6 text-sm text-slate-500">
              TeamBrain est en accès pilote — entrez votre code pour créer un espace.
            </p>
            <InviteCodeForm onValidated={setInviteCode} />
            <p className="mt-6 text-center text-sm text-slate-500">
              Déjà un compte ?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-[600px] animate-fade-in rounded-modal border border-slate-200 bg-white p-8 shadow-dropdown dark:border-slate-800 dark:bg-slate-900">
        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-between">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    i <= step
                      ? "bg-primary text-white"
                      : "border-2 border-slate-200 text-slate-400 dark:border-slate-700"
                  }`}
                >
                  {i + 1}
                </div>
                <span className="hidden text-[10px] text-slate-500 sm:block">{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"}`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={step === lastStep ? handleFinish : (e) => { e.preventDefault(); setStep(step + 1); }}>
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Créer votre espace</h1>
              <div>
                <label className="tb-label">Nom de l&apos;organisation</label>
                <input
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="tb-input"
                />
              </div>
              <div>
                <label className="tb-label">Mission / activité principale</label>
                <textarea
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  rows={3}
                  placeholder="Décrivez ce que fait votre organisation — cette information alimente la mémoire du système."
                  className="tb-input min-h-[80px] resize-y"
                />
              </div>
              <div>
                <label className="tb-label">Objectifs (optionnel)</label>
                <textarea
                  value={orgGoals}
                  onChange={(e) => setOrgGoals(e.target.value)}
                  rows={2}
                  placeholder="Ex. améliorer le suivi terrain, centraliser les décisions…"
                  className="tb-input min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Secteur</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                >
                  {INDUSTRIES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Taille de l&apos;équipe</label>
                <select
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                >
                  {TEAM_SIZES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Langue principale</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                >
                  {LANGUAGES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === adminStep && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Compte administrateur</h1>
              <div>
                <label className="text-sm font-medium">{t("fullName")}</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("email")}</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("password")}</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirmer le mot de passe</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                />
              </div>
            </div>
          )}

          {step === inviteStep && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Inviter l&apos;équipe</h1>
              <p className="text-sm text-stone-500">
                Optionnel — les personnes ajoutées recevront un email avec un lien et un code unique.
                Elles restent <strong>en attente</strong> jusqu&apos;à acceptation et n&apos;apparaissent pas comme membres actifs.
              </p>
              <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">Invitations en attente (envoi à la fin)</p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {invites.map((inv) => (
                    <span
                      key={inv.email}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {inv.email}
                      <span className="text-stone-500">({ROLES.find((r) => r.value === inv.role)?.label}) · en attente</span>
                      <button
                        type="button"
                        onClick={() => setInvites(invites.filter((i) => i.email !== inv.email))}
                        className="ml-1 text-stone-400 hover:text-stone-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email@exemple.sn"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={onInviteKeyDown}
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="rounded-lg border border-stone-300 px-2 py-2 dark:border-stone-700 dark:bg-stone-800"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-stone-500">
                {ROLES.map((r) => (
                  <li key={r.value}>
                    <strong>{r.label}:</strong> {r.description.replace("Agent terrain", terms.field_agent)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === modulesStep && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Modules actifs</h1>
              <p className="text-sm text-stone-500">
                Préréglage pour votre secteur — {terms.work_unit}, {terms.field_report.toLowerCase()}, etc.
              </p>
              <div className="space-y-2">
                {MODULES.map((m) => (
                  <label key={m.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={modules.includes(m.id)}
                      onChange={() => toggleModule(m.id)}
                    />
                    {m.id === "field-reports" ? terms.field_report : m.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-between">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="text-sm text-stone-500">
                Retour
              </button>
            ) : (
              <Link href="/" className="text-sm text-stone-500">Accueil</Link>
            )}
            <button
              type="submit"
              disabled={loading}
              className="tb-btn-primary h-10 px-6"
            >
              {loading ? t("loading") : step === lastStep ? "Créer l'espace" : t("continue")}
            </button>
          </div>
        </form>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
