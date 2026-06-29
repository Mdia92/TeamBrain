"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Mic, Send } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { isOrgAdmin } from "@/app/lib/permissions";
import { useTranslation } from "@/app/lib/use-locale";
import { cn } from "@/app/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantAvatar, AssistantLabel } from "@/components/assistant/assistant-avatar";
import { VoiceNoteCapture } from "@/components/voice-note-capture";

type PendingSuggestion = {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
  label: string;
};

type AssistantAnswer = {
  answer: string;
  confidence: number;
  confidence_label: string;
  sources: string[];
  api_configured?: boolean;
  actions_taken?: string[];
  pending_suggestions?: PendingSuggestion[];
};

type PendingAction = {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
  label?: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: AssistantAnswer;
};

const SUGGESTIONS = [
  "Qui doit livrer?",
  "Résumé de la semaine",
  "Prochaines échéances",
  "Quelles décisions récentes?",
  "Quels événements cette semaine?",
];

function confidenceBadgeClass(label: string): string {
  if (label === "Haute") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (label === "Moyenne") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AssistantPageContent />
    </Suspense>
  );
}

function AssistantPageContent() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const isAdmin = isOrgAdmin(user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showVoice, setShowVoice] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !prefilled.current) {
      prefilled.current = true;
      setQuestion(q);
    }
  }, [searchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    apiClient
      .get<{ items: PendingAction[]; can_approve: boolean }>("/api/pending-actions")
      .then((r) => {
        setPendingActions(r.items);
        setCanApprove(r.can_approve);
      })
      .catch(() => {});
  }, []);

  async function reviewAction(id: string, approve: boolean) {
    const path = approve ? "approve" : "reject";
    try {
      await apiClient.post(`/api/pending-actions/${id}/${path}`);
      setPendingActions((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Erreur");
    }
  }

  function suggestionLabel(a: PendingAction): string {
    if (a.action_type === "create_task" || a.action_type === "task_suggestion") {
      return `Je suggère de créer la tâche « ${String(a.payload?.title ?? "")} »`;
    }
    if (a.action_type === "whatsapp_send") {
      return `Je suggère d'envoyer un rappel WhatsApp à ${String(a.payload?.recipient_name ?? "")}`;
    }
    return `Suggestion: ${a.action_type}`;
  }

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setError("");
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: q.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);
    try {
      const r = await apiClient.postLong<AssistantAnswer>("/api/assistant/ask", { question: q.trim() });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: r.answer, meta: r },
      ]);
      if (r.pending_suggestions?.length) {
        if (isAdmin) {
          setPendingActions((prev) => [
            ...r.pending_suggestions!.map((s) => ({
              id: s.id,
              action_type: s.action_type,
              payload: s.payload,
              label: s.label,
              created_at: new Date().toISOString(),
            })),
            ...prev,
          ]);
        }
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Erreur de l'assistant");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-6rem)]">
      <PageHeader
        title={t("assistant")}
        description={t("assistantPageDescription")}
      />

      <div className="tb-card flex flex-1 flex-col overflow-hidden">
        {pendingActions.length > 0 && (
          <div className="space-y-2 border-b border-slate-200 p-4 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase text-slate-500">Actions en attente</p>
            {pendingActions.map((a) => (
              <div key={a.id} className="rounded-input border border-slate-200 p-3 text-sm dark:border-slate-700">
                <p>{a.label ?? suggestionLabel(a)}</p>
                {canApprove ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reviewAction(a.id, true)}
                      className="tb-btn-primary h-8 px-3 text-xs"
                    >
                      ✓ Approuver
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewAction(a.id, false)}
                      className="tb-btn-secondary h-8 px-3 text-xs"
                    >
                      ✗ Rejeter
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Suggestion envoyée à l&apos;administrateur pour approbation
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <AssistantAvatar className="mb-3 h-12 w-12" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("assistantHello")}</p>
              <p className="mt-1 text-sm">Posez une question ou choisissez une suggestion ci-dessous.</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-modal px-4 py-3 text-sm",
                  m.role === "user"
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
                )}
              >
                {m.role === "assistant" && (
                  <div className="mb-2 flex items-center gap-2">
                    <AssistantAvatar />
                    <AssistantLabel />
                    {m.meta && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          confidenceBadgeClass(m.meta.confidence_label ?? "Faible"),
                        )}
                      >
                        {m.meta.confidence_label} ({Math.round((m.meta.confidence ?? 0) * 100)}%)
                      </span>
                    )}
                    {m.meta?.api_configured === false && (
                      <span className="text-xs text-amber-600">Clé API requise</span>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.meta?.sources && m.meta.sources.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSources((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                      }
                      className="flex items-center gap-1 text-xs font-medium text-slate-500"
                    >
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", expandedSources[m.id] && "rotate-180")}
                      />
                      Sources ({m.meta.sources.length})
                    </button>
                    {expandedSources[m.id] && (
                      <ul className="mt-2 space-y-1 text-xs text-slate-500">
                        {m.meta.sources.map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start gap-2">
              <AssistantAvatar />
              <div className="rounded-modal border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                {t("assistantThinking")}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                disabled={loading}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-400"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {showVoice && (
              <VoiceNoteCapture
                compact
                title="Question vocale"
                uploadPath="/api/documents/voice-note"
                onComplete={(r) => {
                  setShowVoice(false);
                  const q = r.transcript?.trim() || r.ai_summary?.trim();
                  if (q) void ask(q);
                }}
                onError={(msg) => setError(msg)}
                className="rounded-input border border-slate-200 p-3 dark:border-slate-700"
              />
            )}
            <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("askAssistant")}
              className="tb-input flex-1"
              disabled={loading}
            />
            <button
              type="button"
              className={cn("tb-btn-secondary hidden sm:inline-flex", showVoice && "border-primary text-primary")}
              title="Note vocale"
              disabled={loading}
              onClick={() => setShowVoice((v) => !v)}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button type="submit" disabled={loading || !question.trim()} className="tb-btn-primary h-10 px-4">
              <Send className="h-4 w-4" />
            </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
