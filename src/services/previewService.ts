import { currentUser } from "./accessService.ts";
import { storage } from "../lib/storage.ts";
import { isGestureAttempt } from "./progressService.ts";
import type { Gesture } from "../types/lesson";
import type { GestureAttempt } from "../types/progress";

export const previewExercise: Gesture = {
  id: "preview-hand", slug: "hand-in-frame", label: "Рука в кадре", title: "Удержите руку в кадре",
  category: "word", kind: "static", difficulty: 1,
  description: "Поднимите одну руку так, чтобы запястье и все пальцы были видны. Удерживайте её в центре кадра до заполнения кольца. Это проверка обнаружения руки, а не жест РЖЯ.",
  referenceMedia: { kind: "image", src: "/assets/branding/camera-zone.svg", alt: "Схема области камеры: рука должна полностью помещаться внутри рамки. Это не эталон РЖЯ." },
};
// The preview (use without an account) keeps nothing between page loads: the
// result lives only in memory, so a reload starts the preview from scratch.
const legacyKey = "preview:completed";
storage.remove(legacyKey); // drop results saved by older versions
let completed: GestureAttempt | undefined;

export const previewService = {
  getResult(): GestureAttempt | undefined {
    if (!currentUser()?.isGuest) return undefined;
    return completed;
  },
  complete(attempt: GestureAttempt) {
    if (!currentUser()?.isGuest || this.getResult() || !isGestureAttempt(attempt)
      || attempt.gestureId !== previewExercise.id || attempt.mode !== "real" || !attempt.success) return false;
    completed = attempt;
    return true;
  },
  /** Forget the preview result (also happens on every page reload). */
  reset() {
    completed = undefined;
  },
};
