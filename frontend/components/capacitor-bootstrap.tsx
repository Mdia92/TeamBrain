"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { isCapacitorNative } from "@/app/lib/capacitor-env";
import { initPushNotifications, setPushToastHandler } from "@/app/lib/push-notifications";
import {
  startNetworkWatcher,
  subscribeNetworkStatus,
  syncPendingWrites,
} from "@/app/lib/offline-sync";
import { apiClient } from "@/app/lib/api";
import { useToast } from "@/components/ui/toast";
import { OfflineBanner } from "@/components/offline-banner";

export function CapacitorBootstrap() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setPushToastHandler(toast);
  }, [toast]);

  useEffect(() => {
    void startNetworkWatcher();
    const unsub = subscribeNetworkStatus((online) => {
      if (online) {
        void syncPendingWrites((items) => apiClient.post("/api/sync/push", { items }));
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isCapacitorNative()) return;
    void (async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#4F46E5" });
        await SplashScreen.hide();
      } catch {
        /* plugins optional on web */
      }
    })();
  }, []);

  useEffect(() => {
    void initPushNotifications(user?.id);
  }, [user?.id]);

  return <OfflineBanner />;
}
