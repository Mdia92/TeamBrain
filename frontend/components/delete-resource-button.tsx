"use client";

import { Trash2 } from "lucide-react";
import { apiClient, ApiRequestError } from "@/app/lib/api";
import { useTranslation } from "@/app/lib/use-locale";
import { useToast } from "@/components/ui/toast";

export function DeleteResourceButton({
  path,
  label,
  onDeleted,
  className,
}: {
  path: string;
  label?: string;
  onDeleted?: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();

  async function handleDelete() {
    const msg = label
      ? `${t("deleteConfirm")} « ${label} » ?`
      : t("deleteConfirmGeneric");
    if (!window.confirm(msg)) return;
    try {
      await apiClient.delete(path);
      toast(t("deleted"), "success");
      onDeleted?.();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : t("deleteError"), "error");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      className={
        className ??
        "tb-btn-secondary flex w-full items-center justify-center gap-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
      }
    >
      <Trash2 className="h-4 w-4" />
      {t("delete")}
    </button>
  );
}
