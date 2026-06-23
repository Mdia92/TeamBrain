import { PushNotifications } from "@capacitor/push-notifications";
import { apiClient } from "@/app/lib/api";
import { isCapacitorNative, capacitorPlatform } from "@/app/lib/capacitor-env";

type ToastFn = (message: string, variant?: "info" | "success" | "error") => void;

let registeredUserId: string | null = null;
let toastHandler: ToastFn | null = null;
let listenersAttached = false;

export function setPushToastHandler(fn: ToastFn): void {
  toastHandler = fn;
}

async function registerTokenWithBackend(token: string, userId: string): Promise<void> {
  try {
    await apiClient.post("/api/notifications/register", {
      token,
      platform: capacitorPlatform(),
      user_id: userId,
    });
  } catch {
    /* backend may be unavailable */
  }
}

export async function initPushNotifications(userId: string | undefined): Promise<void> {
  if (!userId || !isCapacitorNative()) return;

  if (!listenersAttached) {
    listenersAttached = true;

    PushNotifications.addListener("registration", async (token) => {
      if (registeredUserId) {
        await registerTokenWithBackend(token.value, registeredUserId);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("push registration error", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const title = notification.title ?? "TeamBrain";
      const body = notification.body ?? "";
      toastHandler?.(`${title}: ${body}`, "info");
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data as { url?: string } | undefined;
      if (data?.url && typeof window !== "undefined") {
        window.location.href = data.url;
      }
    });
  }

  if (registeredUserId === userId) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  registeredUserId = userId;
  await PushNotifications.register();
}
