const prefix = "rsl-trainer:v1:";
const memory = new Map<string, unknown>();
let available = true;

export const storage = {
  read(key: string): unknown {
    if (memory.has(key)) return memory.get(key);
    try {
      const value = localStorage.getItem(prefix + key);
      return value === null ? memory.get(key) : (JSON.parse(value) as unknown);
    } catch {
      return memory.get(key);
    }
  },
  write(key: string, value: unknown) {
    memory.set(key, value);
    try {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    } catch {
      available = false;
    }
  },
  remove(key: string) {
    memory.delete(key);
    try {
      localStorage.removeItem(prefix + key);
    } catch {
      // Do not resurrect the stale disk value after a failed removal.
      memory.set(key, undefined);
      available = false;
    }
  },
  isPersistent: () => available,
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
