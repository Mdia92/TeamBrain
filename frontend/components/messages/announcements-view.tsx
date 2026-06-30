"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Heart, Megaphone } from "lucide-react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatRelativeTime } from "@/app/lib/format-locale";
import { useTranslation } from "@/app/lib/use-locale";
import type { I18nKey } from "@/app/lib/i18n";
import { cn } from "@/app/lib/utils";
import { useToast } from "@/components/ui/toast";

type AnnCategory = "info" | "urgent" | "event";

type Announcement = {
  id: string;
  subject: string;
  content: string;
  category: AnnCategory;
  created_at: string;
  sender_name: string;
  sender_role: string;
};

type LikeState = Record<string, { likes: number; liked: boolean }>;

function roleKey(role: string): I18nKey {
  const map: Record<string, I18nKey> = {
    owner: "roleOwner",
    admin: "roleAdmin",
    manager: "roleManager",
    member: "roleMember",
    field_agent: "roleFieldAgent",
  };
  return map[role] ?? "roleMember";
}

function categoryLabel(cat: AnnCategory, t: (k: I18nKey) => string): string {
  if (cat === "urgent") return t("annTypeUrgent");
  if (cat === "event") return t("annTypeEvent");
  return t("annTypeInfo");
}

export function AnnouncementsView() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const orgId = user?.organization_id ?? "";
  const likeKey = `tb-ann-likes-${orgId}`;

  const [items, setItems] = useState<Announcement[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [likes, setLikes] = useState<LikeState>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<AnnCategory>("info");

  const loadLikes = useCallback(() => {
    try {
      const raw = localStorage.getItem(likeKey);
      if (raw) setLikes(JSON.parse(raw) as LikeState);
    } catch {
      setLikes({});
    }
  }, [likeKey]);

  const load = useCallback(async () => {
    const r = await apiClient.get<{ items: Announcement[]; can_publish: boolean }>("/api/messages/announcements");
    setItems(r.items);
    setCanPublish(r.can_publish);
  }, []);

  useEffect(() => {
    loadLikes();
    void load().finally(() => setLoading(false));
    const interval = setInterval(() => void load().catch(console.error), 30_000);
    return () => clearInterval(interval);
  }, [load, loadLikes]);

  function persistLikes(next: LikeState) {
    setLikes(next);
    localStorage.setItem(likeKey, JSON.stringify(next));
  }

  function toggleLike(id: string) {
    const base = likes[id]?.likes ?? 0;
    const wasLiked = likes[id]?.liked ?? false;
    const nextLiked = !wasLiked;
    persistLikes({
      ...likes,
      [id]: { liked: nextLiked, likes: Math.max(0, base + (nextLiked ? 1 : -1)) },
    });
    if (nextLiked) toast(t("annLiked"), "success");
  }

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast(t("annFillRequired"), "error");
      return;
    }
    setSending(true);
    try {
      await apiClient.post("/api/messages/send", {
        subject: title.trim(),
        content: content.trim(),
        broadcast: true,
        category,
      });
      toast(t("annPublished"), "success");
      setTitle("");
      setContent("");
      setCategory("info");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("errorGeneric"), "error");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-850">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Megaphone className="h-5 w-5 text-indigo-500" />
          {t("annTitle")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{t("annDesc")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("annFeed")} ({items.length})
          </span>

          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              {t("annEmpty")}
            </p>
          ) : (
            items.map((ann) => {
              const cat = (ann.category ?? "info") as AnnCategory;
              const like = likes[ann.id] ?? { likes: 0, liked: false };
              return (
                <article
                  key={ann.id}
                  className={cn(
                    "group relative rounded-xl border bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md dark:bg-slate-850",
                    cat === "urgent" && "border-rose-200 bg-rose-50/10 dark:border-rose-500/20 dark:bg-rose-500/5",
                    cat === "event" && "border-emerald-200 bg-emerald-50/10 dark:border-emerald-500/20 dark:bg-emerald-500/5",
                    cat === "info" && "border-slate-200 dark:border-slate-800",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                        cat === "urgent" &&
                          "border-rose-200/20 bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
                        cat === "event" &&
                          "border-emerald-200/20 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                        cat === "info" &&
                          "border-indigo-200/20 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
                      )}
                    >
                      {categoryLabel(cat, t)}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatRelativeTime(ann.created_at, locale)}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-sm font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                      {ann.subject}
                    </h3>
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {ann.content}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3.5 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {(ann.sender_name ?? "?").charAt(0)}
                      </div>
                      <div>
                        <span className="block text-xs font-bold leading-none text-slate-700 dark:text-slate-200">
                          {ann.sender_name}
                        </span>
                        <span className="mt-0.5 block text-[9px] leading-none text-slate-400">
                          {t(roleKey(ann.sender_role))}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleLike(ann.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all hover:scale-105",
                        like.liked
                          ? "border-rose-300/30 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
                      )}
                    >
                      <Heart className={cn("h-3.5 w-3.5 shrink-0", like.liked && "fill-rose-500 text-rose-500")} />
                      {like.likes} {t("annLikes")}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {canPublish ? (
          <div>
            <span className="mb-4 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("annPublishTitle")}
            </span>
            <form
              onSubmit={(e) => void handlePublish(e)}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-850"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {t("annTitleLabel")} *
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("annTitlePlaceholder")}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {t("annCategory")}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["info", "urgent", "event"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCategory(type)}
                      className={cn(
                        "rounded-md border py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                        category === type
                          ? type === "urgent"
                            ? "border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                            : type === "event"
                              ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800",
                      )}
                    >
                      {type === "urgent" ? t("annTypeUrgent") : type === "event" ? t("annTypeEventShort") : t("annTypeInfoShort")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {t("annContent")} *
                </label>
                <textarea
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("annContentPlaceholder")}
                  className={cn(inputClass, "resize-none")}
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                <Megaphone className="h-4 w-4" />
                {sending ? t("settingsSavingProfile") : t("annPublish")}
              </button>
            </form>
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {t("annAdminOnly")}
          </p>
        )}
      </div>
    </div>
  );
}
