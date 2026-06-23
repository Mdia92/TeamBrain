import Link from "next/link";
import { LEGAL_FOOTER_LINE, LEGAL_PAGES } from "@/lib/legal-content";
import { MarketingFooter, TeamBrainLogo } from "@/components/marketing-shell";

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((slug) => ({ slug }));
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const page = LEGAL_PAGES[params.slug];
  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold">Page introuvable</h1>
        <Link href="/legal" className="mt-4 text-primary hover:underline">
          Retour aux pages légales
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <TeamBrainLogo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <Link href="/legal" className="text-sm text-primary hover:underline">
          ← Toutes les pages légales
        </Link>
        <p className="mt-4 text-xs text-slate-500">Dernière mise à jour : {page.updated}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{page.title}</h1>
        <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
          {page.sections.map((section) => (
            <section key={section.title} className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{section.title}</h2>
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 40)} className="mt-3 leading-relaxed text-slate-600 dark:text-slate-400">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-500 dark:border-slate-800">
          {LEGAL_FOOTER_LINE}
        </p>
        <Link href="/" className="mt-4 block text-center text-sm text-primary hover:underline">
          Retour à l&apos;accueil
        </Link>
      </main>
      <MarketingFooter />
    </div>
  );
}
