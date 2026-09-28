import type { Point3 } from "../vision/types";
import type {
  RecognitionResult,
  RecognitionStatus,
  VisionAdapter,
  VisionCallbacks,
} from "../types/vision";

export const initialRecognition = (
  targetGesture: string,
): RecognitionResult => ({
  status: "idle",
  targetGesture,
  confidence: 0,
  holdProgress: 0,
});

// An illustrative open hand for testing highlights; this is NOT an RSL reference.
const demoLandmarks: readonly Point3[] = [
  [0.5, 0.84],
  [0.39, 0.72],
  [0.29, 0.61],
  [0.22, 0.5],
  [0.16, 0.42],
  [0.38, 0.53],
  [0.36, 0.37],
  [0.35, 0.24],
  [0.34, 0.13],
  [0.49, 0.5],
  [0.49, 0.32],
  [0.49, 0.18],
  [0.49, 0.07],
  [0.59, 0.53],
  [0.61, 0.36],
  [0.62, 0.24],
  [0.63, 0.14],
  [0.68, 0.59],
  [0.73, 0.46],
  [0.76, 0.37],
  [0.78, 0.29],
].map(([x = 0, y = 0]) => ({ x, y, z: 0 }));

export function createMockVision(targetGesture: string, callbacks: VisionCallbacks): VisionAdapter {
  let timer: ReturnType<typeof setInterval> | undefined;
  let startedAt = 0;
  let pausedAt: number | null = null;
  let manual: RecognitionResult | null = null;
  async function initialize() {
    /* No model is loaded in the explicit demo mode. */
  }
  async function start() {
    stop();
    startedAt = performance.now();
    manual = null;
    pausedAt = null;
    timer = setInterval(() => tick(), 100);
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
  }
  function simulate(status: RecognitionStatus, confidence = 0.8, holdProgress = 0) {
    manual = makeResult(status, confidence, holdProgress);
  }
  function pause(paused: boolean) {
    if (paused && pausedAt === null) pausedAt = performance.now();
    if (!paused && pausedAt !== null) {
      startedAt += performance.now() - pausedAt;
      pausedAt = null;
    }
  }
  function makeResult(
    status: RecognitionStatus,
    confidence: number,
    holdProgress: number,
  ): RecognitionResult {
    const result: RecognitionResult = { status, targetGesture, confidence, holdProgress };
    switch (status) {
      case "almost": return { ...result,
        message: "Согните мизинец — сейчас он выпрямлен.",
        errorCodes: ["FINGER_NOT_BENT"], incorrectLandmarks: [17, 18, 19, 20],
      };
      case "incorrect": return { ...result,
        message: "Поверните ладонь к камере — сейчас она повёрнута ребром.",
        errorCodes: ["PALM_ORIENTATION"], incorrectLandmarks: [0, 5, 9, 13, 17],
      };
      case "environment-error": return { ...result,
        message: "Рука не полностью в кадре. Отодвиньте её немного дальше.",
        errorCodes: ["HAND_OUT_OF_FRAME"],
      };
      case "success": return { ...result, correctLandmarks: Array.from({ length: 21 }, (_, index) => index) };
      default: return result;
    }
  }
  function tick() {
    if (pausedAt !== null) return;
    const elapsed = performance.now() - startedAt;
    let result = manual;
    if (!result) {
      if (elapsed < 1200) result = makeResult("idle", 0, 0);
      else if (elapsed < 2600) result = makeResult("searching", 0.45, 0);
      else if (elapsed < 5100) result = makeResult("almost", 0.72, 0);
      else if (elapsed < 7000) result = makeResult("searching", 0.92, (elapsed - 5100) / 1900);
      else result = makeResult("success", 0.92, 1);
    }
    callbacks.onResult(result);
    const landmarks =
      result.status === "idle" || result.status === "environment-error"
        ? []
        : demoLandmarks;
    callbacks.onFrame(landmarks);
    if (result.status === "success") stop();
  }

  return { mode: "demo", initialize, start, stop, pause, simulate };
}
