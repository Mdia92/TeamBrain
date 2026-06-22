const DB_NAME = "teambrain-offline";
const STORE = "field_reports";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "client_id" });
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
  created_at: string;
};

export async function saveOfflineReport(report: OfflineFieldReport): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(report);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingReports(): Promise<OfflineFieldReport[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OfflineFieldReport[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineReport(clientId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncPendingReports(
  pushFn: (items: { entity_type: string; client_id: string; payload: Record<string, unknown> }[]) => Promise<unknown>,
): Promise<number> {
  const pending = await getPendingReports();
  if (pending.length === 0) return 0;
  await pushFn(
    pending.map((p) => ({
      entity_type: "field_report",
      client_id: p.client_id,
      payload: { ...p },
    })),
  );
  for (const p of pending) await removeOfflineReport(p.client_id);
  return pending.length;
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
