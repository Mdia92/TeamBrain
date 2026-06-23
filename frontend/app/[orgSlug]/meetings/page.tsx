"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Mic, Upload } from "lucide-react";
import { apiClient, uploadFile, ApiRequestError } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { canEditContent, memberApprovalHint } from "@/app/lib/permissions";
import { t } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { TbCard } from "@/components/ui/tb-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { useGsapStagger } from "@/hooks/use-gsap-stagger";

type Meeting = {
  id: string;
  title: string;
  date: string;
  ai_summary: string | null;
  processing_status: string;
};

type MeetingCard = Meeting & { decisionsCount: number };

type MeetingDetail = {
  title: string;
  date: string;
  ai_summary: string | null;
  decisions: { decision_text: string; decided_by?: string }[];
  action_items: { description: string; status: string }[];
};

function statusLabel(status: string): { label: string; className: string } {
  if (status === "completed") {
    return {
      label: "Analysée",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    };
  }
  if (status === "processing") {
    return {
      label: "En cours",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    };
  }
  return {
    label: "En attente",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
}

function ParticipantStack({ title }: { title: string }) {
  const seeds = [title.slice(0, 1), "É", "Q"].filter(Boolean);
  return (
    <div className="flex -space-x-2">
      {seeds.slice(0, 3).map((s, i) => (
        <div
          key={i}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-semibold text-primary dark:border-slate-900 dark:bg-indigo-950"
        >
          {s.toUpperCase()}
        </div>
      ))}
    </div>
  );
}

export default function MeetingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = canEditContent(user);
  const [meetings, setMeetings] = useState<MeetingCard[]>([]);
  const [selected, setSelected] = useState<MeetingCard | null>(null);
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useGsapStagger<HTMLDivElement>([meetings.length]);

  const enrichMeetings = useCallback(async (items: Meeting[]) => {
    const enriched = await Promise.all(
      items.map(async (m) => {
        if (m.processing_status !== "completed") {
          return { ...m, decisionsCount: 0 };
        }
        try {
          const d = await apiClient.get<{ decisions: unknown[] }>(`/api/meetings/${m.id}`);
          return { ...m, decisionsCount: d.decisions?.length ?? 0 };
        } catch {
          return { ...m, decisionsCount: 0 };
        }
      }),
    );
    setMeetings(enriched);
  }, []);

  const load = useCallback(async () => {
    const r = await apiClient.get<{ items: Meeting[] }>("/api/meetings");
    await enrichMeetings(r.items);
    setLoading(false);
  }, [enrichMeetings]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    apiClient
      .get<MeetingDetail>(`/api/meetings/${selected.id}`)
      .then(setDetail)
      .catch(console.error);
  }, [selected]);

  function handleFile(file: File | null) {
    if (file && file.type.startsWith("audio/")) setAudioFile(file);
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) {
      toast(memberApprovalHint(), "info");
      return;
    }
    if (!audioFile || !title.trim()) return;
    setUploading(true);
    const form = new FormData();
    form.append("title", title.trim());
    form.append("audio", audioFile);
    try {
      const r = (await uploadFile("/api/meetings", form)) as {
        summary: string;
        tasks_created: string[];
      };
      toast(`Réunion analysée — ${r.tasks_created?.length ?? 0} tâche(s) créée(s)`, "success");
      setTitle("");
      setAudioFile(null);
      void load();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur de téléversement", "error");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <CardSkeleton lines={5} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("meetings")} description="Enregistrez et analysez vos réunions avec l'IA." />

      {canEdit ? (
        <form onSubmit={handleUpload} className="tb-card p-6">
          <div>
            <label className="tb-label" htmlFor="meeting-title">Titre de la réunion</label>
            <input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="tb-input"
              placeholder="Ex. Point hebdomadaire équipe"
            />
          </div>
          <div
            className={cn(
              "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-10 transition-colors",
              dragOver
                ? "border-primary bg-indigo-50 dark:bg-indigo-950/30"
                : "border-slate-300 bg-slate-50 hover:border-primary/50 dark:border-slate-700 dark:bg-slate-900/50",
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0] ?? null); }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          >
            <Upload className="mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Glissez un fichier audio ici</p>
            {audioFile && (
              <p className="mt-3 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{audioFile.name}</p>
            )}
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          </div>
          <button type="submit" disabled={uploading || !audioFile} className="tb-btn-primary mt-4 h-10">
            {uploading ? "Traitement en cours..." : "Téléverser et analyser"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">{memberApprovalHint()} pour téléverser une réunion.</p>
      )}

      {meetings.length === 0 ? (
        <EmptyState icon={Mic} title="Aucune réunion enregistrée" description="Téléversez un enregistrement audio pour extraire décisions et tâches automatiquement." />
      ) : (
        <div ref={gridRef} className="grid gap-4 md:grid-cols-2">
          {meetings.map((m) => {
            const st = statusLabel(m.processing_status);
            return (
              <TbCard key={m.id} stagger interactive onClick={() => setSelected(m)} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{m.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(m.date).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", st.className)}>{st.label}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <ParticipantStack title={m.title} />
                  {m.decisionsCount > 0 && (
                    <span className="text-xs text-slate-500">{m.decisionsCount} décision{m.decisionsCount > 1 ? "s" : ""}</span>
                  )}
                </div>
                {m.ai_summary && <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{m.ai_summary}</p>}
              </TbCard>
            );
          })}
        </div>
      )}

      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? "Réunion"}>
        {detail ? (
          <div className="space-y-4 text-sm">
            <p className="text-slate-500">{new Date(detail.date).toLocaleString("fr-FR")}</p>
            {detail.ai_summary && (
              <div className="rounded-input bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500">Résumé</p>
                <p className="mt-1">{detail.ai_summary}</p>
              </div>
            )}
            {detail.decisions?.length > 0 && (
              <div>
                <p className="font-medium">Décisions</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {detail.decisions.map((d, i) => (
                    <li key={i}>{d.decision_text}</li>
                  ))}
                </ul>
              </div>
            )}
            {detail.action_items?.length > 0 && (
              <div>
                <p className="font-medium">Actions</p>
                <ul className="mt-2 space-y-1">
                  {detail.action_items.map((a, i) => (
                    <li key={i} className="rounded-input border border-slate-100 px-2 py-1 dark:border-slate-800">{a.description}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chargement...</p>
        )}
      </DetailDrawer>
    </div>
  );
}
