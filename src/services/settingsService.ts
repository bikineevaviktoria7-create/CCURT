import { useSyncExternalStore } from "react";
import { isRecord, storage } from "../lib/storage";
import type { UserSettings } from "../types/auth";

const DEFAULT_SETTINGS: UserSettings = {
  dominantHand: "right",
  soundEnabled: true,
  speechEnabled: true,
  calibrationCompleted: false,
};

/** Key-value storage the settings are kept in. */
type SettingsStorage = Pick<typeof storage, "read" | "write">;

/** Observable user settings and per-device preferences. */
export interface SettingsStore {
  /** Current settings snapshot (arrow field: passed to `useSyncExternalStore`). */
  get: () => UserSettings;
  update(patch: Partial<UserSettings>): void;
  /** Adds a change listener and returns the unsubscribe function (arrow field). */
  subscribe: (listener: () => void) => () => void;
  learnerName(userId: string): string | null;
  setLearnerName(userId: string, name: string): void;
  toleranceOverride(): number | null;
}

/** User settings in localStorage, observable via `useSyncExternalStore`. */
export class SettingsService implements SettingsStore {
  private storage: SettingsStorage;
  private current: UserSettings;
  private listeners = new Set<() => void>();

  constructor(settingsStorage: SettingsStorage) {
    this.storage = settingsStorage;
    this.current = this.read();
  }

  get = (): UserSettings => this.current;

  update(patch: Partial<UserSettings>) {
    this.current = { ...this.current, ...patch };
    this.storage.write("settings", this.current);
    this.notify();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Name for the "own name" lesson, per learner. */
  learnerName(userId: string) {
    const value = this.storage.read(`learner-name:${userId}`);
    return typeof value === "string" ? value : null;
  }

  setLearnerName(userId: string, name: string) {
    this.storage.write(`learner-name:${userId}`, name);
    this.current = { ...this.current }; // new snapshot so subscribed screens re-render
    this.notify();
  }

  /** Previously saved recognition strictness on this device. */
  toleranceOverride() {
    const value = this.storage.read("recognition-tolerance");
    return typeof value === "number" ? value : null;
  }

  private read(): UserSettings {
    const value = this.storage.read("settings");
    if (!isRecord(value)) return DEFAULT_SETTINGS;
    const saved = { ...value };
    delete saved.vibrationEnabled;
    return { ...DEFAULT_SETTINGS, ...(saved as Partial<UserSettings>) };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

/** Shared settings store of the app. */
export const settingsService: SettingsStore = new SettingsService(storage);

/** Current settings; re-renders the component when they change. */
export function useSettings() {
  return useSyncExternalStore(settingsService.subscribe, settingsService.get);
}
