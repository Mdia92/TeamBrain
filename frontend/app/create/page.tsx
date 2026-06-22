"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { t } from "@/app/lib/i18n";
import * as authApi from "@/app/lib/auth-api";

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
  { id: "whatsapp", label: "WhatsApp" },
];

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Membre" },
  { value: "field_agent", label: "Agent terrain" },
];

type InviteRow = { email: string; role: string };

export default function CreateOrgPage() {
  const { signup, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("ngo");
  const [teamSize, setTeamSize] = useState("1-10");
  const [language, setLanguage] = useState("fr");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invites, setInvites] = useState<InviteRow[]>([{ email: "", role: "member" }]);
  const [modules, setModules] = useState<string[]>(MODULES.map((m) => m.id));

  async function handleFinish(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signup({
        organization_name: orgName,
        full_name: fullName,
        email,
        password,
        industry,
        team_size: teamSize,
        primary_language: language,
      });
      const validInvites = invites.filter((i) => i.email.includes("@"));
      await authApi.completeOnboarding({
        industry,
        team_size: teamSize,
        primary_language: language,
        modules,
        invites: validInvites,
      });
      const profile = await refreshUser();
      router.push(`/${profile?.org_slug ?? "app"}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(id: string) {
    setModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  const steps = ["Organisation", "Compte admin", "Inviter l'équipe", "Modules"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4 dark:bg-stone-950">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-6 flex gap-2">
          {steps.map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded ${i <= step ? "bg-amber-600" : "bg-stone-200 dark:bg-stone-700"}`}
              title={label}
            />
          ))}
        </div>

        <form onSubmit={step === 3 ? handleFinish : (e) => { e.preventDefault(); setStep(step + 1); }}>
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Créer votre espace</h1>
              <div>
                <label className="text-sm font-medium">Nom de l&apos;organisation</label>
                <input
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
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

          {step === 1 && (
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Inviter l&apos;équipe</h1>
              <p className="text-sm text-stone-500">Optionnel — vous pourrez inviter plus tard.</p>
              {invites.map((inv, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email@exemple.sn"
                    value={inv.email}
                    onChange={(e) => {
                      const next = [...invites];
                      next[idx] = { ...next[idx], email: e.target.value };
                      setInvites(next);
                    }}
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
                  />
                  <select
                    value={inv.role}
                    onChange={(e) => {
                      const next = [...invites];
                      next[idx] = { ...next[idx], role: e.target.value };
                      setInvites(next);
                    }}
                    className="rounded-lg border border-stone-300 px-2 py-2 dark:border-stone-700 dark:bg-stone-800"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setInvites([...invites, { email: "", role: "member" }])}
                className="text-sm text-amber-700 hover:underline"
              >
                + Ajouter une invitation
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Modules actifs</h1>
              <p className="text-sm text-stone-500">Les modules non cochés seront masqués du menu.</p>
              <div className="space-y-2">
                {MODULES.map((m) => (
                  <label key={m.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={modules.includes(m.id)}
                      onChange={() => toggleModule(m.id)}
                    />
                    {m.label}
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
              className="rounded-lg bg-amber-700 px-6 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {loading ? t("loading") : step === 3 ? "Créer l'espace" : t("continue")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
