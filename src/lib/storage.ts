const STORAGE_PREFIX = "rsl-trainer:v1:";

/** JSON key-value store. */
export interface KeyValueStorage {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
  remove(key: string): void;
  /** False after localStorage failed; values then live only in memory (arrow field). */
  isPersistent: () => boolean;
}

/** JSON key-value store over localStorage with an in-memory fallback. */
export class BrowserStorage implements KeyValueStorage {
  private prefix: string;
  private memory = new Map<string, unknown>();
  private available = true;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  read(key: string): unknown {
    if (this.memory.has(key)) return this.memory.get(key);
    try {
      const value = localStorage.getItem(this.prefix + key);
      return value === null ? this.memory.get(key) : (JSON.parse(value) as unknown);
    } catch {
      return this.memory.get(key);
    }
  }

  write(key: string, value: unknown) {
    this.memory.set(key, value);
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      this.available = false;
    }
  }

  remove(key: string) {
    this.memory.delete(key);
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      // Do not resurrect the stale disk value after a failed removal.
      this.memory.set(key, undefined);
      this.available = false;
    }
  }

  isPersistent = () => this.available;
}

/** Shared app storage under the `rsl-trainer:v1:` prefix. */
export const storage: KeyValueStorage = new BrowserStorage(STORAGE_PREFIX);

/** True for a plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
