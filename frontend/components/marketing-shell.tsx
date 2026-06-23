import Link from "next/link";

export function TeamBrainLogo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
        TB
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        TeamBrain
      </span>
    </Link>
  );
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-[400px] animate-fade-in rounded-modal border border-slate-200 bg-white p-8 shadow-dropdown dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex justify-center">
            <TeamBrainLogo />
          </div>
          <h1 className="text-center text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          {subtitle && <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">{footer}</div>}
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-12 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <TeamBrainLogo />
          <p className="mt-3 text-sm text-slate-500">Le cerveau collectif de votre équipe</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Produit</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/#features" className="text-slate-600 hover:text-primary dark:text-slate-400">
                Fonctionnalités
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-slate-600 hover:text-primary dark:text-slate-400">
                Tarifs
              </Link>
            </li>
            <li>
              <Link href="/#trust" className="text-slate-600 hover:text-primary dark:text-slate-400">
                Sécurité
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Légal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/legal/cgu" className="text-slate-600 hover:text-primary dark:text-slate-400">
                CGU
              </Link>
            </li>
            <li>
              <Link href="/legal/confidentialite" className="text-slate-600 hover:text-primary dark:text-slate-400">
                Confidentialité
              </Link>
            </li>
            <li>
              <Link href="/legal/mentions-legales" className="text-slate-600 hover:text-primary dark:text-slate-400">
                Mentions légales
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="mailto:contact@teambrain.app" className="text-slate-600 hover:text-primary dark:text-slate-400">
                contact@teambrain.app
              </a>
            </li>
            <li>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-primary dark:text-slate-400"
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl border-t border-slate-200 px-6 pt-6 text-center text-xs text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} TeamBrain · Fait à Dakar, Sénégal
      </p>
    </footer>
  );
}
