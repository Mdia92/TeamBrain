"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/app/lib/utils";
import { TeamBrainLogo } from "@/components/marketing-shell";

export function LandingNav({ dark = false }: { dark?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkClass = dark
    ? "text-slate-300 hover:text-white"
    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white";

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/10 bg-slate-950/80 shadow-lg backdrop-blur-md"
          : dark
            ? "bg-transparent"
            : "bg-white/80 backdrop-blur-sm dark:bg-slate-950/80",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <TeamBrainLogo className={dark || scrolled ? "[&_span:last-child]:text-white" : ""} />
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#features" className={cn("text-sm font-medium", linkClass)}>
            Fonctionnalités
          </a>
          <a href="#pricing" className={cn("text-sm font-medium", linkClass)}>
            Tarifs
          </a>
          <Link href="/login" className={cn("text-sm font-medium", linkClass)}>
            Se connecter
          </Link>
          <Link href="/create" className="tb-btn-primary h-10 px-4 text-sm">
            Essai gratuit
          </Link>
        </nav>
        <button
          type="button"
          className={cn("rounded-input p-2 md:hidden", dark || scrolled ? "text-white" : "text-slate-700")}
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-slate-950/95 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            <a href="#features" className="text-sm text-slate-200" onClick={() => setOpen(false)}>
              Fonctionnalités
            </a>
            <a href="#pricing" className="text-sm text-slate-200" onClick={() => setOpen(false)}>
              Tarifs
            </a>
            <Link href="/login" className="text-sm text-slate-200">
              Se connecter
            </Link>
            <Link href="/create" className="tb-btn-primary h-10 text-center text-sm">
              Essai gratuit
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
