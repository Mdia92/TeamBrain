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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
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
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row">
        <TeamBrainLogo />
        <nav className="flex flex-wrap justify-center gap-4">
          <Link href="/pricing" className="hover:text-primary">
            Forfaits
          </Link>
          <Link href="/login" className="hover:text-primary">
            Connexion
          </Link>
          <Link href="/create" className="hover:text-primary">
            Créer un espace
          </Link>
        </nav>
        <p className="text-xs">© {new Date().getFullYear()} TeamBrain</p>
      </div>
    </footer>
  );
}
