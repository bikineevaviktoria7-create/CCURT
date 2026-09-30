import { getCurrentUser } from "./accessService.ts";
import { storage } from "../lib/storage.ts";
import { isGestureAttempt } from "./progressService.ts";
import type { User } from "../types/auth";
import type { Gesture } from "../types/lesson";
import type { GestureAttempt } from "../types/progress";

/** The only preview exercise: keep a hand in the frame. */
export const previewGesture: Gesture = {
  id: "preview-hand", slug: "hand-in-frame", label: "Рука в кадре", title: "Удержите руку в кадре",
  category: "word", kind: "static", difficulty: 1,
  description: "Поднимите одну руку так, чтобы запястье и все пальцы были видны. Удерживайте её в центре кадра до заполнения кольца. Это проверка обнаружения руки, а не жест русского жестового языка.",
  referenceMedia: { kind: "image", src: "/assets/branding/camera-zone.svg", alt: "Схема области камеры: рука должна полностью помещаться внутри рамки. Это не эталон русского жестового языка." },
};
// The preview (use without an account) keeps nothing between page loads: the
// result lives only in memory, so a reload starts the preview from scratch.
const LEGACY_PREVIEW_KEY = "preview:completed";
storage.remove(LEGACY_PREVIEW_KEY); // drop results saved by older versions

/** Result of the guest preview, kept only in memory. */
export interface PreviewStore {
  getResult(): GestureAttempt | undefined;
  complete(attempt: GestureAttempt): boolean;
  reset(): void;
}

/** In-memory result of the guest preview. */
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

  /** Saves a successful real preview attempt once; returns whether it was accepted. */
  complete(attempt: GestureAttempt) {
    if (!this.getCurrentUser()?.isGuest || this.getResult() || !isGestureAttempt(attempt)
      || attempt.gestureId !== previewGesture.id || attempt.mode !== "real" || !attempt.success) return false;
    this.completed = attempt;
    return true;
  }

  /** Forget the preview result (also happens on every page reload). */
  reset() {
    this.completed = undefined;
  }
}

/** Shared preview store of the app. */
export const previewService: PreviewStore = new PreviewService(getCurrentUser);
