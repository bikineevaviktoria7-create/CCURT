const STORAGE_PREFIX = "rsl-trainer:v1:";

/** JSON-хранилище «ключ — значение». */
export interface KeyValueStorage {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
  remove(key: string): void;
  /** False после сбоя localStorage; значения тогда хранятся только в памяти (поле-стрелка). */
  isPersistent: () => boolean;
}

/** JSON-хранилище «ключ — значение» поверх localStorage с запасным хранением в памяти. */
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
      // После неудачного удаления не возвращаем устаревшее значение с диска.
      this.memory.set(key, undefined);
      this.available = false;
    }
  }

  isPersistent = () => this.available;
}

/** Общее хранилище приложения с префиксом `rsl-trainer:v1:`. */
export const storage: KeyValueStorage = new BrowserStorage(STORAGE_PREFIX);

/** True для простого объекта (не null и не массив). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
