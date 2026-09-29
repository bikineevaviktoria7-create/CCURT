import { useSyncExternalStore } from "react";
import { isRecord, storage } from "../lib/storage";
import type { UserSettings } from "../types/auth";

const defaults: UserSettings = {
  dominantHand: "right",
  soundEnabled: true,
  speechEnabled: true,
  calibrationCompleted: false,
};

let current: UserSettings = read();
const listeners = new Set<() => void>();

function read(): UserSettings {
  const value = storage.read("settings");
  if (!isRecord(value)) return defaults;
  const saved = { ...value };
  delete saved.vibrationEnabled;
  return { ...defaults, ...(saved as Partial<UserSettings>) };
}

export const settingsService = {
  get: () => current,
  update(patch: Partial<UserSettings>) {
    current = { ...current, ...patch };
    storage.write("settings", current);
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Name for the "own name" lesson, per learner. */
  learnerName(userId: string) {
    const value = storage.read(`learner-name:${userId}`);
    return typeof value === "string" ? value : null;
  },
  setLearnerName(userId: string, name: string) {
    storage.write(`learner-name:${userId}`, name);
    current = { ...current }; // new snapshot so subscribed screens re-render
    listeners.forEach((listener) => listener());
  },
  /** Previously saved recognition strictness on this device. */
  toleranceOverride() {
    const value = storage.read("recognition-tolerance");
    return typeof value === "number" ? value : null;
  },
};

export function useSettings() {
  return useSyncExternalStore(settingsService.subscribe, settingsService.get);
}
