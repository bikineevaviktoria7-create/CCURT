import type {
  HandFrame,
  HandLandmark,
  RecognitionResult,
  RecognitionStatus,
  VisionAdapter,
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
const demoLandmarks: readonly HandLandmark[] = [
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

export class MockVisionAdapter implements VisionAdapter {
  private subscribers = new Set<(result: RecognitionResult) => void>();
  private frames = new Set<(frame: HandFrame) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private manual: RecognitionResult | null = null;
  constructor(private targetGesture: string) {}
  async initialize() {
    /* No model is loaded in the explicit demo mode. */
  }
  async start() {
    this.stop();
    this.startedAt = performance.now();
    this.manual = null;
    this.pausedAt = null;
    this.timer = setInterval(() => this.tick(), 100);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  subscribe(callback: (result: RecognitionResult) => void) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
  subscribeFrames(callback: (frame: HandFrame) => void) {
    this.frames.add(callback);
    return () => {
      this.frames.delete(callback);
    };
  }
  simulate(status: RecognitionStatus, confidence = 0.8, holdProgress = 0) {
    this.manual = this.makeResult(status, confidence, holdProgress);
  }
  resume() {
    this.manual = null;
    this.startedAt = performance.now();
  }
  pause(paused: boolean) {
    if (paused && this.pausedAt === null) this.pausedAt = performance.now();
    if (!paused && this.pausedAt !== null) {
      this.startedAt += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }
  private makeResult(
    status: RecognitionStatus,
    confidence: number,
    holdProgress: number,
  ): RecognitionResult {
    return {
      status,
      targetGesture: this.targetGesture,
      confidence,
      holdProgress,
      ...(status === "almost"
        ? {
            message: "Согните мизинец — сейчас он выпрямлен.",
            errorCodes: ["FINGER_NOT_BENT"] as const,
            incorrectLandmarks: [17, 18, 19, 20],
          }
        : {}),
      ...(status === "incorrect"
        ? {
            message: "Поверните ладонь к камере — сейчас она повёрнута ребром.",
            errorCodes: ["PALM_ORIENTATION"] as const,
            incorrectLandmarks: [0, 5, 9, 13, 17],
          }
        : {}),
      ...(status === "environment-error"
        ? {
            message: "Рука не полностью в кадре. Отодвиньте её немного дальше.",
            errorCodes: ["HAND_OUT_OF_FRAME"] as const,
          }
        : {}),
      ...(status === "success"
        ? { correctLandmarks: Array.from({ length: 21 }, (_, index) => index) }
        : {}),
    };
  }
  private tick() {
    if (this.pausedAt !== null) return;
    const elapsed = performance.now() - this.startedAt;
    const result =
      this.manual ??
      (elapsed < 1200
        ? this.makeResult("idle", 0, 0)
        : elapsed < 2600
          ? this.makeResult("searching", 0.45, 0)
          : elapsed < 5100
            ? this.makeResult("almost", 0.72, 0)
            : elapsed < 7000
              ? this.makeResult("searching", 0.92, (elapsed - 5100) / 1900)
              : this.makeResult("success", 0.92, 1));
    for (const callback of this.subscribers) callback(result);
    const landmarks =
      result.status === "idle" || result.status === "environment-error"
        ? []
        : demoLandmarks;
    for (const callback of this.frames)
      callback({ timestamp: performance.now(), landmarks });
    if (result.status === "success") this.stop();
  }
}
