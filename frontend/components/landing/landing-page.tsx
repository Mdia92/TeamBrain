"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import {
  Brain,
  Check,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
  Users,
  Zap,
} from "lucide-react";
import type { User } from "@/app/lib/api";
import { gsap } from "@/lib/gsapConfig";
import { cn } from "@/app/lib/utils";
import { LandingNav } from "@/components/landing/landing-nav";
import { MarketingFooter } from "@/components/marketing-shell";

const HERO_WORDS = "Votre équipe ne devrait jamais oublier".split(" ");

const PROBLEMS = [
  {
    title: "Les décisions se perdent",
    body: "Vos réunions produisent des engagements. Personne ne s'en souvient.",
    icon: Brain,
  },
  {
    title: "La coordination s'effrite",
    body: "Qui fait quoi? Où en est le projet? Les réponses sont dans 10 chats différents.",
    icon: Users,
  },
  {
    title: "Le nouveau arrive perdu",
    body: "Chaque départ emporte de la mémoire. Chaque arrivée repart de zéro.",
    icon: Zap,
  },
];

const FEATURES = [
  {
    id: "memory",
    title: "Mémoire Organisationnelle",
    description:
      "Chaque décision, engagement et rapport est capturé et relié. Votre organisation construit sa mémoire — elle ne l'oublie jamais.",
    visual: "memory",
    reverse: false,
  },
  {
    id: "assistant",
    title: "Assistant Intelligent",
    description:
      "Posez n'importe quelle question sur votre organisation. L'assistant cite ses sources et ne fabrique jamais de réponse.",
    visual: "chat",
    reverse: true,
  },
  {
    id: "coordination",
    title: "Coordination Automatique",
    description:
      "Rappels d'engagements, alertes de retard, suggestions d'actions. Le cerveau veille pendant que votre équipe travaille.",
    visual: "notifications",
    reverse: false,
  },
  {
    id: "documents",
    title: "Documents Intelligents",
    description:
      "PDF, Word, Excel, PowerPoint, images — tout est lu, compris et intégré dans la mémoire collective.",
    visual: "docs",
    reverse: true,
  },
];

const STEPS = [
  { title: "Créez votre espace", desc: "Configurez votre organisation en quelques minutes.", icon: "1" },
  { title: "Invitez votre équipe", desc: "Ajoutez collègues et agents terrain par email.", icon: "2" },
  { title: "Le cerveau apprend", desc: "Chaque action enrichit la mémoire collective.", icon: "3" },
];

const PRICING = [
  {
    name: "Starter",
    price: "5 000 FCFA/mois",
    features: ["5 utilisateurs", "Mémoire organisationnelle", "Rapports terrain", "Support email"],
  },
  {
    name: "Pro",
    price: "15 000 FCFA/mois",
    features: ["Utilisateurs illimités", "Assistant IA", "WhatsApp", "Priorité support"],
    highlight: true,
  },
  {
    name: "Entreprise",
    price: "Sur mesure",
    features: ["SSO & audit", "Support dédié", "SLA personnalisé", "Formation équipe"],
  },
];

function MemoryMockup() {
  const items = ["Décision réunion — livrer avant vendredi", "Rapport terrain Thiès", "Engagement Ahmed — budget Q2"];
  return (
    <div className="rounded-modal border border-slate-200 bg-white p-4 shadow-dropdown dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-3 text-xs font-semibold uppercase text-slate-400">Timeline mémoire</p>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t} className="mock-timeline-item flex gap-2 rounded-input bg-slate-50 p-2 text-xs dark:bg-slate-800">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatMockup() {
  return (
    <div className="space-y-2 rounded-modal border border-slate-200 bg-white p-4 shadow-dropdown dark:border-slate-700 dark:bg-slate-900">
      <div className="mock-chat-item ml-auto max-w-[85%] rounded-modal bg-primary px-3 py-2 text-xs text-white">
        Qui doit livrer le rapport cette semaine ?
      </div>
      <div className="mock-chat-item max-w-[90%] rounded-modal border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
        <p className="font-medium text-primary">Moyenne (72%)</p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Ahmed et Fatou ont des tâches en retard depuis mardi.</p>
        <p className="mt-2 text-[10px] text-slate-400">Sources: tasks:abc · memory:def</p>
      </div>
    </div>
  );
}

function NotificationsMockup() {
  const notes = ["Tâche en retard — Ahmed", "Rappel engagement réunion", "Rapport terrain manquant"];
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <div
          key={n}
          className="mock-notif-item rounded-input border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950/50"
        >
          {n}
        </div>
      ))}
    </div>
  );
}

function DocsMockup() {
  const icons = [FileText, FileSpreadsheet, Presentation, ImageIcon];
  return (
    <div className="relative flex h-40 items-center justify-center">
      <div className="mock-doc-icons flex gap-3">
        {icons.map((Icon, i) => (
          <div key={i} className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-primary dark:bg-indigo-950">
            <Icon className="h-6 w-6" />
          </div>
        ))}
      </div>
      <div className="mock-brain-target absolute flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg">
        <Brain className="h-8 w-8" />
      </div>
    </div>
  );
}

function FeatureVisual({ type }: { type: string }) {
  if (type === "memory") return <MemoryMockup />;
  if (type === "chat") return <ChatMockup />;
  if (type === "notifications") return <NotificationsMockup />;
  return <DocsMockup />;
}

export function LandingPage({ user = null }: { user?: User | null }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".hero-word", {
        opacity: 0,
        y: 48,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: { trigger: "#hero", start: "top 85%" },
      });
      gsap.from(".hero-sub", {
        opacity: 0,
        y: 32,
        duration: 0.8,
        delay: 0.2,
        ease: "power3.out",
        scrollTrigger: { trigger: "#hero", start: "top 85%" },
      });
      gsap.from(".hero-cta", {
        opacity: 0,
        scale: 0.8,
        duration: 0.8,
        ease: "back.out(1.4)",
        stagger: 0.15,
        scrollTrigger: { trigger: "#hero", start: "top 80%" },
      });
      gsap.from(".hero-trust", {
        opacity: 0,
        duration: 0.5,
        delay: 0.4,
        ease: "power3.out",
        scrollTrigger: { trigger: "#hero", start: "top 80%" },
      });

      gsap.from(".problem-card", {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.2,
        scrollTrigger: { trigger: "#problems", start: "top 80%" },
      });
      gsap.from(".problem-tagline", {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: "#problems", start: "top 75%" },
      });

      gsap.utils.toArray<HTMLElement>(".feature-block").forEach((block) => {
        const fromX = block.dataset.side === "right" ? 60 : -60;
        gsap.from(block, {
          opacity: 0,
          x: fromX,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: block, start: "top 80%" },
        });
        const inner = block.querySelectorAll(".mock-timeline-item, .mock-chat-item, .mock-notif-item, .mock-doc-icons");
        if (inner.length) {
          gsap.from(inner, {
            opacity: 0,
            y: 16,
            duration: 0.5,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: { trigger: block, start: "top 75%" },
          });
        }
        const brain = block.querySelector(".mock-brain-target");
        if (brain) {
          gsap.from(brain, {
            scale: 0,
            duration: 0.8,
            ease: "back.out(1.6)",
            scrollTrigger: { trigger: block, start: "top 70%" },
          });
        }
      });

      gsap.from(".step-item", {
        opacity: 0,
        y: 32,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: { trigger: "#how-it-works", start: "top 80%" },
      });
      gsap.from(".step-line-fill", {
        scaleX: 0,
        duration: 1.2,
        ease: "power3.out",
        transformOrigin: "left center",
        scrollTrigger: { trigger: "#how-it-works", start: "top 75%" },
      });

      gsap.from(".pricing-card", {
        opacity: 0,
        scale: 0.92,
        y: 24,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: { trigger: "#pricing", start: "top 80%" },
      });

      gsap.from(".trust-item", {
        opacity: 0,
        y: 24,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: { trigger: "#trust", start: "top 80%" },
      });

      gsap.from(".final-cta-text", {
        opacity: 0,
        y: 32,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: "#final-cta", start: "top 80%" },
      });
      gsap.to(".final-cta-btn", {
        scale: 1.04,
        duration: 1.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        scrollTrigger: { trigger: "#final-cta", start: "top 85%" },
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <LandingNav dark user={user} />
      <main>
        {/* HERO */}
        <section id="hero" className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#0F172A] px-4 pt-20 text-center sm:px-6">
          <div className="landing-mesh pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto max-w-4xl">
            <h1 className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {HERO_WORDS.map((word) => (
                <span key={word} className="hero-word inline-block">
                  {word}
                </span>
              ))}
            </h1>
            <p className="hero-sub mx-auto mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl">
              TeamBrain est le cerveau collectif de votre organisation. Il mémorise, coordonne et agit — pour que rien
              ne se perde.
            </p>
            <div className="hero-cta mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/create"
                className="inline-flex h-12 items-center justify-center rounded-input bg-primary px-6 text-base font-medium text-white hover:bg-indigo-600"
              >
                Créer votre espace — Gratuit 30 jours
              </Link>
              <a
                href="#demo"
                className="inline-flex h-12 items-center justify-center rounded-input border border-white/30 px-6 text-base font-medium text-white hover:bg-white/10"
              >
                Voir la démo
              </a>
            </div>
            <p className="hero-trust mt-6 text-sm text-slate-400">
              Aucune carte requise · Prêt en 2 minutes · Données sécurisées
            </p>
          </div>
        </section>

        {/* PROBLEMS */}
        <section id="problems" className="bg-white px-4 py-20 dark:bg-slate-950 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 md:grid-cols-3">
              {PROBLEMS.map(({ title, body, icon: Icon }) => (
                <div key={title} className="problem-card rounded-modal border border-slate-200 p-6 dark:border-slate-800">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{body}</p>
                </div>
              ))}
            </div>
            <p className="problem-tagline mt-12 text-center text-xl font-bold text-primary">
              TeamBrain résout ces 3 problèmes.
            </p>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="bg-slate-50 px-4 py-20 dark:bg-slate-900/50 sm:px-6">
          <div id="demo" className="mx-auto max-w-6xl space-y-24">
            {FEATURES.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "feature-block grid items-center gap-10 lg:grid-cols-2",
                  f.reverse && "lg:[&>div:first-child]:order-2",
                )}
                data-side={f.reverse ? "right" : "left"}
              >
                <div>
                  <h2 className="text-2xl font-bold md:text-3xl">{f.title}</h2>
                  <p className="mt-4 text-slate-600 dark:text-slate-400">{f.description}</p>
                </div>
                <FeatureVisual type={f.visual} />
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="bg-white px-4 py-20 dark:bg-slate-950 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">Comment ça marche</h2>
            <div className="relative hidden h-1 overflow-hidden rounded-full bg-slate-200 md:block dark:bg-slate-800">
              <div className="step-line-fill h-full w-full bg-primary" />
            </div>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.title} className="step-item text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                    {s.icon}
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="bg-slate-50 px-4 py-20 dark:bg-slate-900/50 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">Tarifs simples</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {PRICING.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    "pricing-card relative flex flex-col rounded-modal border bg-white p-6 transition-transform hover:-translate-y-1 hover:shadow-dropdown dark:bg-slate-900",
                    tier.highlight ? "border-primary shadow-dropdown" : "border-slate-200 dark:border-slate-800",
                  )}
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-slate-900">
                    Essai gratuit 30 jours
                  </span>
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                  <p className="mt-2 text-2xl font-semibold text-primary">{tier.price}</p>
                  <ul className="mt-6 flex-1 space-y-2 text-sm">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Link href="/create" className="tb-btn-primary mt-8 h-10 w-full text-center">
                    Commencer
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section id="trust" className="bg-indigo-900 px-4 py-20 text-white sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <p className="trust-item text-lg font-medium">
              🇸🇳 Conçu pour les équipes africaines
            </p>
            <p className="trust-item mt-4 text-slate-300">
              Fonctionne hors ligne · WhatsApp · Français & Wolof
            </p>
            <div className="trust-item mx-auto mt-10 max-w-md rounded-modal border border-white/20 bg-white/5 p-6 text-left">
              <p className="text-sm italic text-slate-200">
                « Enfin une plateforme qui comprend nos réalités terrain. Notre équipe ne perd plus le fil des
                engagements. »
              </p>
              <p className="mt-3 text-xs text-slate-400">— Directrice ONG, Dakar (témoignage à venir)</p>
            </div>
            <p className="trust-item mt-8 text-sm text-indigo-200">
              Chiffrement · Données isolées · Aucun partage
            </p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section
          id="final-cta"
          className="bg-gradient-to-b from-indigo-900 to-slate-950 px-4 py-24 text-center text-white sm:px-6"
        >
          <h2 className="final-cta-text text-3xl font-bold md:text-4xl">
            Prêt à donner une mémoire à votre équipe ?
          </h2>
          <Link
            href="/create"
            className="final-cta-btn mt-8 inline-flex h-14 items-center justify-center rounded-input bg-accent px-10 text-lg font-semibold text-slate-900 hover:bg-amber-400"
          >
            Commencer gratuitement
          </Link>
          <p className="mt-6 text-sm text-slate-400">
            Ou contactez-nous :{" "}
            <a href="mailto:contact@teambrain.app" className="underline hover:text-white">
              contact@teambrain.app
            </a>
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
