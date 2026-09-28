import { currentUser } from "./accessService.ts";
import { isRecord, storage } from "../lib/storage.ts";
import { isGestureAttempt } from "./progressService.ts";
import type { Gesture } from "../types/lesson";
import type { GestureAttempt } from "../types/progress";

export const previewExercise: Gesture = {
  id: "preview-hand", slug: "hand-in-frame", label: "Рука в кадре", title: "Удержите руку в кадре",
  category: "word", kind: "static", difficulty: 1,
  description: "Поднимите одну руку так, чтобы запястье и все пальцы были видны. Удерживайте её в центре кадра до заполнения кольца. Это проверка обнаружения руки, а не жест РЖЯ.",
  referenceMedia: { kind: "image", src: "/assets/branding/camera-zone.svg", alt: "Схема области камеры: рука должна полностью помещаться внутри рамки. Это не эталон РЖЯ." },
};
const key = "preview:completed";
export const previewService = {
  getResult(): GestureAttempt | undefined {
    if (!currentUser()?.isGuest) return undefined;
    const value = storage.read(key);
    return isRecord(value) && isGestureAttempt(value.attempt) && value.attempt.gestureId === previewExercise.id
      && value.attempt.mode === "real" && value.attempt.success ? value.attempt : undefined;
  },
  complete(attempt: GestureAttempt) {
    if (!currentUser()?.isGuest || this.getResult() || !isGestureAttempt(attempt)
      || attempt.gestureId !== previewExercise.id || attempt.mode !== "real" || !attempt.success) return false;
    // One preview per browser. This marker is separate from lesson progress.
    storage.write(key, { attempt });
    return true;
  },
};
