"use client";

import { FormEvent, useEffect, useState } from "react";
import { Camera, ExternalLink, FileText, MapPin, MapPinned, Mic, Wifi, WifiOff } from "lucide-react";
import { apiClient, ApiRequestError, OfflineQueuedError, uploadFile } from "@/app/lib/api";
import { attachFieldReportPhoto } from "@/app/lib/camera";
import { useAuth } from "@/app/contexts/AuthContext";
import { canCreateContent, canEditContent, memberApprovalHint } from "@/app/lib/permissions";
import { t } from "@/app/lib/i18n";
import {
  getPendingCount,
  isOnline,
  subscribeNetworkStatus,
} from "@/app/lib/offline-sync";
import { cn } from "@/app/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { TbCard } from "@/components/ui/tb-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { VoiceNoteCapture } from "@/components/voice-note-capture";
import { useGsapStagger } from "@/hooks/use-gsap-stagger";

type Doc = {
  id: string;
  title: string;
  file_url: string;
  ai_summary: string | null;
  doc_type: string;
  ocr_text?: string | null;
  location_name?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  mission_date?: string | null;
};

const TABS = [
  { id: "all", label: "Tous" },
  { id: "document", label: "Documents" },
  { id: "field_report", label: "Rapports terrain" },
  { id: "meeting_notes", label: "Notes de réunion" },
  { id: "voice_note", label: "Notes vocales" },
] as const;

const ACCEPT_FILES =
  ".pdf,.doc,.docx,.xlsx,.xls,.csv,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.m4a,.mp3,.ogg,.wav,.webm";

export default function DocumentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canCreate = canCreateContent(user);
  const canEdit = canEditContent(user);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [tab, setTab] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Doc[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [voiceTitle, setVoiceTitle] = useState("Note vocale");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const typeParam = tab === "all" ? "" : `?type=${tab}`;
    const r = await apiClient.get<{ items: Doc[] }>(`/api/documents${typeParam}`);
    setDocs(r.items);
    setPending(await getPendingCount());
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when tab changes
  }, [tab]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q && TABS.some((t) => t.id === q)) setTab(q);
  }, []);

  useEffect(() => {
    setOnline(isOnline());
    const unsub = subscribeNetworkStatus((next) => {
      setOnline(next);
      if (next) void load();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file") as File;
    if (!file?.size) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const docAllowed = ["pdf", "doc", "docx", "xlsx", "xls", "csv", "pptx", "txt", "md", "png", "jpg", "jpeg", "webp"];
    const audioAllowed = ["m4a", "mp3", "ogg", "wav", "webm", "mpeg", "aac"];
    if (!docAllowed.includes(ext) && !audioAllowed.includes(ext)) {
      toast("Format de fichier non supporté", "error");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("title", String(fd.get("title") || file.name));
    if (audioAllowed.includes(ext)) body.append("doc_type", "voice_note");
    setUploading(true);
    try {
      await uploadFile("/api/documents", body);
      toast("Document téléversé", "success");
      form.reset();
      await load();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : "Erreur de téléversement", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleFieldSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      mission_date: new Date().toISOString().split("T")[0],
      location_name: String(fd.get("location_name") || ""),
      description: String(fd.get("description") || ""),
      latitude: Number(fd.get("latitude") || 0) || undefined,
      longitude: Number(fd.get("longitude") || 0) || undefined,
      photos: photoData ? [photoData] : [],
    };
    try {
      await apiClient.post("/api/documents/field-report", payload);
      toast(online ? "Rapport terrain soumis" : "Rapport enregistré hors ligne", online ? "success" : "info");
      e.currentTarget.reset();
      setPhotoData(null);
      setPhotoPreview(null);
      setShowFieldForm(false);
      void load();
    } catch (err) {
      if (err instanceof OfflineQueuedError) {
        toast("Rapport enregistré hors ligne — synchronisation à la reconnexion", "info");
        setShowFieldForm(false);
        setPending((n) => n + 1);
        return;
      }
      toast(err instanceof ApiRequestError ? err.message : "Erreur", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSearch() {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const r = await apiClient.get<{ items: Doc[] }>(`/api/documents/search?q=${encodeURIComponent(query)}`);
    setSearchResults(r.items);
  }

  async function handleSummarize(id: string) {
    const r = await apiClient.post<{ summary: string }>(`/api/documents/${id}/summarize`);
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ai_summary: r.summary } : d)));
  }

  function captureGps() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const lat = document.querySelector<HTMLInputElement>('input[name="latitude"]');
      const lng = document.querySelector<HTMLInputElement>('input[name="longitude"]');
      if (lat) lat.value = String(pos.coords.latitude);
      if (lng) lng.value = String(pos.coords.longitude);
      toast("Position GPS capturée", "success");
    });
  }

  async function capturePhoto() {
    const dataUrl = await attachFieldReportPhoto();
    if (dataUrl) {
      setPhotoData(dataUrl);
      setPhotoPreview(dataUrl);
      toast("Photo attachée", "success");
    }
  }

  const display = searchResults ?? docs;
  const listRef = useGsapStagger<HTMLDivElement>([display.length, tab]);

  if (loading) return <CardSkeleton lines={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("documents")}
        description="Documents, rapports terrain, notes — un seul module unifié."
        actions={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                online
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
              )}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? t("online") : t("offline")}
            </span>
            {pending > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                {pending} en attente
              </span>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setSearchResults(null);
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "voice_note" ? (
        <div className="tb-card space-y-4 p-6">
          {!canCreate && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{memberApprovalHint()}</p>
          )}
          <h3 className="font-semibold">Enregistrer une note vocale</h3>
          <p className="text-sm text-slate-500">
            La note est transcrite automatiquement et indexée dans la mémoire organisationnelle.
          </p>
          <VoiceNoteCapture
            disabled={!canCreate}
            title={voiceTitle}
            onTitleChange={setVoiceTitle}
            onComplete={() => {
              toast("Note vocale transcrite", "success");
              setVoiceTitle("Note vocale");
              void load();
            }}
            onError={(msg) => toast(msg, "error")}
          />
        </div>
      ) : (
      <form onSubmit={handleUpload} className="tb-card flex flex-wrap items-end gap-4 p-6">
        {!canCreate && (
          <p className="w-full text-xs text-amber-700 dark:text-amber-400">{memberApprovalHint()}</p>
        )}
        <div className="min-w-[200px] flex-1">
          <label className="tb-label" htmlFor="doc-title">
            Titre
          </label>
          <input id="doc-title" name="title" placeholder="Titre du document" className="tb-input" />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="tb-label" htmlFor="doc-file">
            Fichier (PDF, Word, Excel, PPT, texte, image)
          </label>
          <input id="doc-file" name="file" type="file" required accept={ACCEPT_FILES} className="text-sm" />
        </div>
        <button type="submit" disabled={!canCreate || uploading} className="tb-btn-primary min-h-11">
          {uploading ? t("loading") : t("upload")}
        </button>
        <button
          type="button"
          onClick={() => setShowFieldForm(!showFieldForm)}
          className="tb-btn-secondary min-h-11"
        >
          {t("newReport")}
        </button>
      </form>
      )}

      {showFieldForm && (
        <form onSubmit={handleFieldSubmit} className="tb-card animate-slide-up space-y-4 p-6">
          <h3 className="font-semibold">Nouveau rapport terrain</h3>
          <div>
            <label className="tb-label" htmlFor="location_name">
              Lieu de mission
            </label>
            <input id="location_name" name="location_name" className="tb-input" placeholder="Ex. Thiès" />
          </div>
          <div>
            <label className="tb-label" htmlFor="description">
              Observations *
            </label>
            <textarea id="description" name="description" required rows={4} className="tb-input min-h-[100px] py-2" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="latitude" type="number" step="any" placeholder="Latitude" className="tb-input" />
            <input name="longitude" type="number" step="any" placeholder="Longitude" className="tb-input" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={captureGps} className="tb-btn-secondary min-h-11">
              <MapPinned className="h-4 w-4" />
              GPS
            </button>
            <button type="button" onClick={() => void capturePhoto()} className="tb-btn-secondary min-h-11">
              <Camera className="h-4 w-4" />
              Photo
            </button>
            <button type="submit" disabled={submitting} className="tb-btn-primary min-h-11">
              Soumettre
            </button>
          </div>
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="Preuve" className="max-h-48 rounded-input object-cover" />
          )}
        </form>
      )}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          className="tb-input flex-1"
        />
        <button type="button" onClick={() => void handleSearch()} className="tb-btn-secondary min-h-11">
          {t("search")}
        </button>
      </div>

      {display.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun élément" description="Téléversez un fichier ou soumettez un rapport terrain." />
      ) : (
        <div ref={listRef} className="space-y-3">
          {display.map((d) => {
            const hasGps = d.gps_latitude != null && d.gps_longitude != null;
            return (
              <TbCard key={d.id} stagger interactive onClick={() => setSelected(d)} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{d.title}</h3>
                      {d.doc_type === "field_report" && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-primary dark:bg-indigo-950">
                          Terrain
                        </span>
                      )}
                      {d.doc_type === "voice_note" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          <Mic className="h-3 w-3" />
                          Vocal
                        </span>
                      )}
                      {hasGps && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          <MapPin className="h-3 w-3" />
                          GPS {d.location_name || ""}
                        </span>
                      )}
                    </div>
                    {d.mission_date && <p className="mt-1 text-xs text-slate-500">{d.mission_date}</p>}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSummarize(d.id);
                      }}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Résumer (IA)
                    </button>
                  )}
                </div>
                {d.ai_summary && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{d.ai_summary}</p>}
              </TbCard>
            );
          })}
        </div>
      )}
      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? "Document"}>
        {selected && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-500 capitalize">Type : {selected.doc_type.replace("_", " ")}</p>
            {selected.mission_date && <p>Date mission : {selected.mission_date}</p>}
            {selected.location_name && <p>Lieu : {selected.location_name}</p>}
            {selected.ai_summary && (
              <div className="rounded-input bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500">Résumé IA</p>
                <p className="mt-1">{selected.ai_summary}</p>
              </div>
            )}
            {selected.doc_type === "voice_note" && selected.ocr_text && (
              <div className="rounded-input bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500">Transcription</p>
                <p className="mt-1 whitespace-pre-wrap">{selected.ocr_text}</p>
              </div>
            )}
            {selected.file_url && (
              <a
                href={selected.file_url}
                target="_blank"
                rel="noreferrer"
                className="tb-btn-secondary inline-flex gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ouvrir le fichier
              </a>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
