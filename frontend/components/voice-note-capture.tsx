"use client";

import { FormEvent, useId, useRef, useState } from "react";
import { Loader2, Mic, Square, Upload } from "lucide-react";
import { uploadFile, ApiRequestError } from "@/app/lib/api";
import { cn } from "@/app/lib/utils";

export type VoiceNoteResult = {
  id: string;
  transcript: string;
  ai_summary?: string;
  transcription_available?: boolean;
};

type Props = {
  disabled?: boolean;
  title?: string;
  onTitleChange?: (title: string) => void;
  uploadPath?: string;
  extraFormFields?: Record<string, string>;
  onComplete: (result: VoiceNoteResult) => void;
  onError?: (message: string) => void;
  className?: string;
  compact?: boolean;
};

export function VoiceNoteCapture({
  disabled,
  title = "Note vocale",
  onTitleChange,
  uploadPath = "/api/documents/voice-note",
  extraFormFields,
  onComplete,
  onError,
  className,
  compact,
}: Props) {
  const fileInputId = useId();
  const [recording, setRecording] = useState(false);
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribing">("idle");
  const [lastResult, setLastResult] = useState<VoiceNoteResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  async function uploadBlob(blob: Blob, filename: string) {
    setPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, filename);
      form.append("title", title.trim() || "Note vocale");
      if (extraFormFields) {
        for (const [k, v] of Object.entries(extraFormFields)) form.append(k, v);
      }
      const r = (await uploadFile(uploadPath, form)) as VoiceNoteResult;
      setLastResult(r);
      onComplete(r);
    } catch (err) {
      onError?.(err instanceof ApiRequestError ? err.message : "Erreur de transcription");
    } finally {
      setPhase("idle");
    }
  }

  async function startRecording() {
    if (disabled || phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        void uploadBlob(blob, "voice.webm");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setPhase("recording");
    } catch {
      onError?.("Microphone inaccessible — utilisez le téléversement de fichier");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  async function handleFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("audio") as File;
    if (!file?.size) return;
    await uploadBlob(file, file.name);
    e.currentTarget.reset();
  }

  const busy = phase === "transcribing";

  return (
    <div className={cn("space-y-3", className)}>
      {!compact && onTitleChange && (
        <div>
          <label className="tb-label" htmlFor={`${fileInputId}-title`}>
            Titre
          </label>
          <input
            id={`${fileInputId}-title`}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="tb-input"
            disabled={disabled || busy}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void startRecording()}
            className="tb-btn-primary inline-flex h-10 min-h-11 items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {busy ? "Transcription…" : phase === "recording" ? "Enregistrement…" : "Enregistrer"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="tb-btn-secondary inline-flex h-10 min-h-11 items-center gap-2 border-rose-300 text-rose-700"
          >
            <Square className="h-4 w-4 fill-current" />
            Arrêter
          </button>
        )}
      </div>

      <form onSubmit={handleFile} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="tb-label" htmlFor={fileInputId}>
            Ou téléverser un fichier audio
          </label>
          <input
            id={fileInputId}
            name="audio"
            type="file"
            accept="audio/*,.m4a,.mp3,.ogg,.wav,.webm"
            className="text-sm"
            disabled={disabled || busy || recording}
          />
        </div>
        <button type="submit" disabled={disabled || busy || recording} className="tb-btn-secondary h-10 gap-1">
          <Upload className="h-4 w-4" />
          Envoyer
        </button>
      </form>

      {lastResult && (
        <div className="rounded-input border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-xs font-semibold uppercase text-slate-500">Transcription</p>
          <p className="mt-1 whitespace-pre-wrap">{lastResult.transcript}</p>
          {lastResult.ai_summary && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Résumé</p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{lastResult.ai_summary}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
