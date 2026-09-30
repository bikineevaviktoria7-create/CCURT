import { useSyncExternalStore } from "react";
import { isRecord, storage } from "../lib/storage";
import type { UserSettings } from "../types/auth";

const DEFAULT_SETTINGS: UserSettings = {
  dominantHand: "right",
  soundEnabled: true,
  speechEnabled: true,
  calibrationCompleted: false,
};

/** Хранилище «ключ — значение», в котором лежат настройки. */
type SettingsStorage = Pick<typeof storage, "read" | "write">;

/** Наблюдаемые настройки пользователя и предпочтения устройства. */
export interface SettingsStore {
  /** Текущий снимок настроек (поле-стрелка: передаётся в `useSyncExternalStore`). */
  get: () => UserSettings;
  update(patch: Partial<UserSettings>): void;
  /** Добавляет подписчика на изменения и возвращает функцию отписки (поле-стрелка). */
  subscribe: (listener: () => void) => () => void;
  learnerName(userId: string): string | null;
  setLearnerName(userId: string, name: string): void;
  toleranceOverride(): number | null;
}

/** Настройки пользователя в localStorage, наблюдаемые через `useSyncExternalStore`. */
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

  /** Имя для урока «Своё имя», у каждого ученика своё. */
  learnerName(userId: string) {
    const value = this.storage.read(`learner-name:${userId}`);
    return typeof value === "string" ? value : null;
  }

  setLearnerName(userId: string, name: string) {
    this.storage.write(`learner-name:${userId}`, name);
    this.current = { ...this.current }; // новый снимок, чтобы подписанные экраны перерисовались
    this.notify();
  }

  /** Ранее сохранённая строгость распознавания на этом устройстве. */
  toleranceOverride() {
    const value = this.storage.read("recognition-tolerance");
    // Значение из хранилища недоверенное: вне (0; 5] считаем, что настройки нет.
    return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 5 ? value : null;
  }

  private read(): UserSettings {
    const value = this.storage.read("settings");
    if (!isRecord(value)) return DEFAULT_SETTINGS;
    // Каждое поле проверяется по типу; неверное значение заменяется значением по умолчанию.
    const flag = (key: "soundEnabled" | "speechEnabled" | "calibrationCompleted") =>
      typeof value[key] === "boolean" ? value[key] : DEFAULT_SETTINGS[key];
    return {
      dominantHand:
        value.dominantHand === "left" || value.dominantHand === "right" ? value.dominantHand : DEFAULT_SETTINGS.dominantHand,
      soundEnabled: flag("soundEnabled"),
      speechEnabled: flag("speechEnabled"),
      calibrationCompleted: flag("calibrationCompleted"),
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

/** Общее хранилище настроек приложения. */
export const settingsService: SettingsStore = new SettingsService(storage);

/** Текущие настройки; перерисовывает компонент при их изменении. */
export function useSettings() {
  return useSyncExternalStore(settingsService.subscribe, settingsService.get);
}
