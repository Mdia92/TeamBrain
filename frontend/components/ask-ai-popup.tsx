"use client";

import { Bot, Send, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useTranslation } from "@/app/lib/use-locale";

export const ASK_AI_QUEUE_KEY = "teambrain-ask-ai-queue";

export function pushAskAiMessage(text: string) {
  const raw = sessionStorage.getItem(ASK_AI_QUEUE_KEY);
  const queue: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  queue.push(text.trim());
  sessionStorage.setItem(ASK_AI_QUEUE_KEY, JSON.stringify(queue));
}

export function drainAskAiQueue(): string[] {
  const raw = sessionStorage.getItem(ASK_AI_QUEUE_KEY);
  sessionStorage.removeItem(ASK_AI_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function AskAiPopup({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (pathname.includes("/assistant")) return null;

  function goToAssistant(text: string) {
    const q = text.trim();
    if (q) pushAskAiMessage(q);
    setDraft("");
    setOpen(false);
    router.push(`/${orgSlug}/assistant${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    goToAssistant(draft);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-dropdown transition-transform hover:scale-105 md:bottom-6"
          aria-label={t("askAssistantButton")}
        >
          <Bot className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-[min(100vw-2rem,22rem)] rounded-modal border border-slate-200 bg-white shadow-dropdown dark:border-slate-700 dark:bg-slate-900 md:bottom-6">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="text-sm font-semibold">{t("assistantBrand")}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="p-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder={t("askAssistant")}
              className="tb-input min-h-[4.5rem] resize-none text-sm"
            />
            <button type="submit" className="tb-btn-primary mt-2 flex w-full items-center justify-center gap-2">
              <Send className="h-4 w-4" />
              {t("askAssistantButton")}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">{t("assistantPopupHint")}</p>
          </form>
        </div>
      )}
    </>
  );
}
