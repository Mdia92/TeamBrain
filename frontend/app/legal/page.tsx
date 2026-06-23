import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LEGAL_COMPANY, LEGAL_FOOTER_LINE, LEGAL_INDEX } from "@/lib/legal-content";
import { MarketingFooter, TeamBrainLogo } from "@/components/marketing-shell";

export default function LegalIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <TeamBrainLogo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Informations légales</h1>
        <p className="mt-2 text-slate-500">
          {LEGAL_COMPANY.name} — {LEGAL_COMPANY.city}, {LEGAL_COMPANY.country}
        </p>
        <ul className="mt-10 space-y-3">
          {LEGAL_INDEX.map(({ slug, title, desc }) => (
            <li key={slug}>
              <Link
                href={`/legal/${slug}`}
                className="group flex items-center justify-between rounded-modal border border-slate-200 p-5 transition-colors hover:border-primary hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-primary dark:text-slate-100">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-center text-xs text-slate-500">{LEGAL_FOOTER_LINE}</p>
        <Link href="/" className="mt-6 block text-center text-sm text-primary hover:underline">
          ← Retour à l&apos;accueil
        </Link>
      </main>
      <MarketingFooter />
    </div>
  );
}
