"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import {
  getPendingCount,
  subscribeNetworkStatus,
  syncPendingWrites,
} from "@/app/lib/offline-sync";
import { apiClient } from "@/app/lib/api";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refreshPending = () => {
      void getPendingCount().then(setPending);
    };
    refreshPending();
    const unsub = subscribeNetworkStatus((nextOnline) => {
      setOnline(nextOnline);
      if (nextOnline) {
        setSyncing(true);
        void syncPendingWrites((items) => apiClient.post("/api/sync/push", { items }))
          .then(() => refreshPending())
          .finally(() => setSyncing(false));
      } else {
        refreshPending();
      }
    });
    const interval = setInterval(refreshPending, 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-center text-sm text-white shadow-sm"
      role="status"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      {!online ? (
        <span>Hors ligne — données en attente de synchronisation{pending > 0 ? ` (${pending})` : ""}</span>
      ) : syncing ? (
        <span>Synchronisation en cours…</span>
      ) : pending > 0 ? (
        <span>{pending} élément(s) en attente de synchronisation</span>
      ) : null}
    </div>
  );
}
