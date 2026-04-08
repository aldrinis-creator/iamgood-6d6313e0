// IndexedDB helpers for offline SOS queuing

const DB_NAME = "checkin-offline";
const DB_VERSION = 1;
const SOS_STORE = "sos_queue";
const AUTH_STORE = "auth_store";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SOS_STORE)) {
        db.createObjectStore(SOS_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(AUTH_STORE)) {
        db.createObjectStore(AUTH_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface SOSPayload {
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  trigger_type: string;
  status: string;
}

export async function queueSOS(payload: SOSPayload): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SOS_STORE, "readwrite");
  tx.objectStore(SOS_STORE).add({ ...payload, queued_at: new Date().toISOString() });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dequeueAllSOS(): Promise<SOSPayload[]> {
  const db = await openDB();
  const tx = db.transaction(SOS_STORE, "readwrite");
  const store = tx.objectStore(SOS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result;
      // Clear all
      store.clear();
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function storeAuthForSW(userId: string, accessToken: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(AUTH_STORE, "readwrite");
  tx.objectStore(AUTH_STORE).put({ key: "session", userId, accessToken, updatedAt: Date.now() });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAuthForSW(): Promise<{ userId: string; accessToken: string } | null> {
  const db = await openDB();
  const tx = db.transaction(AUTH_STORE, "readonly");
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(AUTH_STORE).get("session");
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function isOffline(): boolean {
  return !navigator.onLine;
}
