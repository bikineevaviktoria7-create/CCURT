import { getCurrentUser } from "./accessService.ts";
import { storage } from "../lib/storage.ts";
import { isGestureAttempt } from "./progressService.ts";
import type { User } from "../types/auth";
import type { Gesture } from "../types/lesson";
import type { GestureAttempt } from "../types/progress";

/** Единственное пробное упражнение: держать руку в кадре. */
export const previewGesture: Gesture = {
  id: "preview-hand", slug: "hand-in-frame", label: "Рука в кадре", title: "Удержите руку в кадре",
  category: "word", kind: "static", difficulty: 1,
  description: "Поднимите одну руку так, чтобы запястье и все пальцы были видны. Удерживайте её в центре кадра до заполнения кольца. Это проверка обнаружения руки, а не жест русского жестового языка.",
  referenceMedia: { kind: "image", src: "/assets/branding/camera-zone.svg", alt: "Схема области камеры: рука должна полностью помещаться внутри рамки. Это не эталон русского жестового языка." },
};
// Пробный режим (без аккаунта) ничего не хранит между загрузками страницы:
// результат живёт только в памяти, поэтому после перезагрузки проба начинается заново.
const LEGACY_PREVIEW_KEY = "preview:completed";
storage.remove(LEGACY_PREVIEW_KEY); // удаляем результаты, сохранённые старыми версиями

/** Результат гостевой пробы, хранится только в памяти. */
export interface PreviewStore {
  getResult(): GestureAttempt | undefined;
  complete(attempt: GestureAttempt): boolean;
  reset(): void;
}

/** Результат гостевой пробы в памяти. */
export class PreviewService implements PreviewStore {
  private getCurrentUser: () => User | null;
  private completed: GestureAttempt | undefined;

  constructor(currentUser: () => User | null) {
    this.getCurrentUser = currentUser;
    this.completed = undefined;
  }

  getResult(): GestureAttempt | undefined {
    if (!this.getCurrentUser()?.isGuest) return undefined;
    return this.completed;
  }

  /** Один раз сохраняет успешную реальную попытку пробы; возвращает, принята ли она. */
  complete(attempt: GestureAttempt) {
    if (!this.getCurrentUser()?.isGuest || this.getResult() || !isGestureAttempt(attempt)
      || attempt.gestureId !== previewGesture.id || attempt.mode !== "real" || !attempt.success) return false;
    this.completed = attempt;
    return true;
  }

  /** Забывает результат пробы (также происходит при каждой перезагрузке страницы). */
  reset() {
    this.completed = undefined;
  }
}

/** Общее хранилище пробы приложения. */
export const previewService: PreviewStore = new PreviewService(getCurrentUser);
