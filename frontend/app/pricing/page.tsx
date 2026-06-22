import Link from "next/link";

const TIERS = [
  {
    name: "Starter",
    price: "À définir",
    desc: "Petites équipes terrain, modules essentiels",
    features: ["5 utilisateurs", "Mémoire organisationnelle", "Rapports terrain offline"],
  },
  {
    name: "Pro",
    price: "À définir",
    desc: "Organisations en croissance, IA avancée",
    features: ["Utilisateurs illimités", "Assistant IA", "WhatsApp gateway", "Réunions IA"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    desc: "Multi-sites, SLA, intégrations sur mesure",
    features: ["SSO", "Support dédié", "Déploiement on-premise possible"],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <header className="border-b border-stone-200 bg-white px-6 py-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-xl font-bold text-amber-800 dark:text-amber-400">
            TeamBrain
          </Link>
          <Link href="/login" className="text-sm text-amber-700 hover:underline">
            Connexion
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-center text-3xl font-bold">Forfaits TeamBrain</h1>
        <p className="mt-2 text-center text-stone-500">
          30 jours d&apos;essai gratuit — toutes les fonctionnalités, sans carte bancaire
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl border p-6 ${
                tier.highlight
                  ? "border-amber-400 bg-amber-50 shadow-lg dark:border-amber-700 dark:bg-amber-950/30"
                  : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
              }`}
            >
              <h2 className="text-xl font-bold">{tier.name}</h2>
              <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-400">{tier.price}</p>
              <p className="mt-2 text-sm text-stone-500">{tier.desc}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-6 w-full rounded-lg bg-amber-700 py-2 text-sm font-medium text-white hover:bg-amber-800"
              >
                Bientôt disponible
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
