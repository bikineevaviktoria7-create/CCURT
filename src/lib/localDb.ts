// Tiny IndexedDB key-value store for data that is too big for localStorage
// (saved reference samples and gesture photos).
const DB_NAME = "signstep";
const STORE = "kv";
const memory = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Async key-value store in IndexedDB with an in-memory fallback. */
export const localDb = {
  async get<T>(key: string): Promise<T | undefined> {
    const db = await open();
    if (!db) return memory.get(key) as T | undefined;
    try {
      return await new Promise<T | undefined>((resolve) => {
        const request = db.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => resolve(memory.get(key) as T | undefined);
      });
    } finally {
      db.close();
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    memory.set(key, value);
    const db = await open();
    if (!db) return;
    try {
      await new Promise<void>((resolve) => {
        const transaction = db.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
    } finally {
      db.close();
    }
  },
};
