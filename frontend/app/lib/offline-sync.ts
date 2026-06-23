import { Network } from "@capacitor/network";

const DB_NAME = "teambrain-offline";
const STORE_FIELD_REPORTS = "field_reports";
const STORE_WRITE_QUEUE = "write_queue";
const DB_VERSION = 2;

type NetworkListener = (online: boolean) => void;

let networkOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
const listeners = new Set<NetworkListener>();
let networkWatcherStarted = false;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FIELD_REPORTS)) {
        db.createObjectStore(STORE_FIELD_REPORTS, { keyPath: "client_id" });
      }
      if (!db.objectStoreNames.contains(STORE_WRITE_QUEUE)) {
        db.createObjectStore(STORE_WRITE_QUEUE, { keyPath: "client_id" });
      }
    };
  });
}

export type OfflineFieldReport = {
  client_id: string;
  project_id?: string;
  mission_date: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  photos?: string[];
  created_at: string;
};

export type QueuedWrite = {
  client_id: string;
  entity_type: string;
  method: "POST" | "PATCH";
  path: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type SyncPushItem = {
  entity_type: string;
  client_id: string;
  payload: Record<string, unknown>;
};

export class OfflineQueuedError extends Error {
  clientId: string;
  constructor(clientId: string) {
    super("Opération mise en file d'attente hors ligne");
    this.name = "OfflineQueuedError";
    this.clientId = clientId;
  }
}

export async function startNetworkWatcher(): Promise<void> {
  if (networkWatcherStarted || typeof window === "undefined") return;
  networkWatcherStarted = true;

  const apply = (online: boolean) => {
    networkOnline = online;
    listeners.forEach((fn) => fn(online));
  };

  window.addEventListener("online", () => apply(true));
  window.addEventListener("offline", () => apply(false));

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      apply(status.connected);
      await Network.addListener("networkStatusChange", (s) => apply(s.connected));
    }
  } catch {
    /* web fallback only */
  }
}

export function subscribeNetworkStatus(listener: NetworkListener): () => void {
  listeners.add(listener);
  listener(networkOnline);
  return () => listeners.delete(listener);
}

export function isOnline(): boolean {
  return networkOnline;
}

export async function saveOfflineReport(report: OfflineFieldReport): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FIELD_REPORTS, "readwrite");
    tx.objectStore(STORE_FIELD_REPORTS).put(report);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingReports(): Promise<OfflineFieldReport[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FIELD_REPORTS, "readonly");
    const req = tx.objectStore(STORE_FIELD_REPORTS).getAll();
    req.onsuccess = () => resolve(req.result as OfflineFieldReport[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineReport(clientId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FIELD_REPORTS, "readwrite");
    tx.objectStore(STORE_FIELD_REPORTS).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueWrite(item: Omit<QueuedWrite, "created_at" | "client_id"> & { client_id?: string }): Promise<string> {
  const client_id = item.client_id ?? crypto.randomUUID();
  const db = await openDb();
  const record: QueuedWrite = {
    client_id,
    entity_type: item.entity_type,
    method: item.method,
    path: item.path,
    payload: item.payload,
    created_at: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WRITE_QUEUE, "readwrite");
    tx.objectStore(STORE_WRITE_QUEUE).put(record);
    tx.oncomplete = () => resolve(client_id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedWrites(): Promise<QueuedWrite[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WRITE_QUEUE, "readonly");
    const req = tx.objectStore(STORE_WRITE_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedWrite[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedWrite(clientId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WRITE_QUEUE, "readwrite");
    tx.objectStore(STORE_WRITE_QUEUE).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const [reports, writes] = await Promise.all([getPendingReports(), getQueuedWrites()]);
  return reports.length + writes.length;
}

function entityTypeForPath(method: string, path: string): string | null {
  if (method === "POST" && path === "/api/field-reports") return "field_report";
  if (method === "POST" && path === "/api/tasks") return "task_create";
  if (method === "PATCH" && /^\/api\/tasks\/[^/]+\/status$/.test(path)) return "task_status";
  if (method === "POST" && path === "/api/projects") return "project_create";
  if (method === "POST" && path === "/api/messages") return "message_create";
  if (method === "POST" && path === "/api/calendar/events") return "calendar_event";
  return null;
}

export async function tryQueueOfflineWrite(
  method: "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
): Promise<string | null> {
  if (isOnline()) return null;
  const entity_type = entityTypeForPath(method, path);
  if (!entity_type) return null;
  const payload: Record<string, unknown> = { ...(body ?? {}), _method: method, _path: path };
  if (entity_type === "task_status") {
    const match = path.match(/^\/api\/tasks\/([^/]+)\/status$/);
    if (match) payload.task_id = match[1];
  }
  return queueWrite({ entity_type, method, path, payload });
}

export async function buildSyncItems(): Promise<SyncPushItem[]> {
  const [reports, writes] = await Promise.all([getPendingReports(), getQueuedWrites()]);
  const items: SyncPushItem[] = reports.map((p) => ({
    entity_type: "field_report",
    client_id: p.client_id,
    payload: { ...p },
  }));
  for (const w of writes) {
    items.push({
      entity_type: w.entity_type,
      client_id: w.client_id,
      payload: w.payload,
    });
  }
  return items;
}

export async function syncPendingWrites(
  pushFn: (items: SyncPushItem[]) => Promise<unknown>,
): Promise<number> {
  const items = await buildSyncItems();
  if (items.length === 0) return 0;
  await pushFn(items);
  const [reports, writes] = await Promise.all([getPendingReports(), getQueuedWrites()]);
  for (const p of reports) await removeOfflineReport(p.client_id);
  for (const w of writes) await removeQueuedWrite(w.client_id);
  return items.length;
}

/** @deprecated use syncPendingWrites */
export async function syncPendingReports(
  pushFn: (items: SyncPushItem[]) => Promise<unknown>,
): Promise<number> {
  return syncPendingWrites(pushFn);
}
