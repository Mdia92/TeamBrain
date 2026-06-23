import Link from "next/link";
import { MarketingFooter, TeamBrainLogo } from "@/components/marketing-shell";

const PAGES: Record<string, { title: string; body: string }> = {
  cgu: {
    title: "Conditions générales d'utilisation",
    body: "Les conditions générales d'utilisation de TeamBrain seront publiées prochainement. Pour toute question, contactez contact@teambrain.app.",
  },
  confidentialite: {
    title: "Politique de confidentialité",
    body: "Notre politique de confidentialité détaillera comment nous protégeons vos données organisationnelles. Contact : contact@teambrain.app.",
  },
  "mentions-legales": {
    title: "Mentions légales",
    body: "TeamBrain — Plateforme éditée depuis Dakar, Sénégal. Informations légales complètes à venir.",
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const page = PAGES[params.slug];
  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold">Page introuvable</h1>
        <Link href="/" className="mt-4 text-primary hover:underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <TeamBrainLogo />
      </header>
      <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-400">{page.body}</p>
        <Link href="/" className="mt-8 inline-block text-primary hover:underline">
          ← Accueil
        </Link>
      </main>
      <MarketingFooter />
    </div>
  );
}
