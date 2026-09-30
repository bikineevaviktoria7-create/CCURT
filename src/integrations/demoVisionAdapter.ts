import type { Point3 } from "../vision/types";
import type {
  RecognitionResult,
  RecognitionStatus,
  VisionAdapter,
  VisionCallbacks,
} from "../types/vision";

/** Результат распознавания до первого кадра. */
export function initialRecognition(targetLabel: string): RecognitionResult {
  return {
    status: "idle",
    targetLabel,
    confidence: 0,
    holdProgress: 0,
  };
}

// Условная открытая ладонь для проверки подсветки; это НЕ эталон РЖЯ.
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

/** Адаптер по сценарию без модели камеры для явного демо-режима. */
export class DemoVisionAdapter implements VisionAdapter {
  readonly mode = "demo";
  private readonly targetLabel: string;
  private readonly callbacks: VisionCallbacks;
  private timer: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private manual: RecognitionResult | null = null;

  constructor(targetLabel: string, callbacks: VisionCallbacks) {
    this.targetLabel = targetLabel;
    this.callbacks = callbacks;
  }

  async initialize() {
    /* В явном демо-режиме модель не загружается. */
  }

  async start() {
    this.stop();
    this.startedAt = performance.now();
    this.manual = null;
    this.pausedAt = null;
    this.timer = setInterval(this.tick, 100);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  simulate(status: RecognitionStatus, confidence = 0.8, holdProgress = 0) {
    this.manual = this.makeResult(status, confidence, holdProgress);
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
    const result: RecognitionResult = { status, targetLabel: this.targetLabel, confidence, holdProgress };
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

  /** Вызывается каждые 100 мс из `setInterval`; передаётся как колбэк, поэтому стрелочное поле. */
  private readonly tick = () => {
    if (this.pausedAt !== null) return;
    const elapsed = performance.now() - this.startedAt;
    let result = this.manual;
    if (!result) {
      if (elapsed < 1200) result = this.makeResult("idle", 0, 0);
      else if (elapsed < 2600) result = this.makeResult("searching", 0.45, 0);
      else if (elapsed < 5100) result = this.makeResult("almost", 0.72, 0);
      else if (elapsed < 7000) result = this.makeResult("searching", 0.92, (elapsed - 5100) / 1900);
      else result = this.makeResult("success", 0.92, 1);
    }
    this.callbacks.onResult(result);
    const landmarks =
      result.status === "idle" || result.status === "environment-error"
        ? []
        : demoLandmarks;
    this.callbacks.onFrame(landmarks);
    if (result.status === "success") this.stop();
  };
}

/** Создаёт демо-адаптер; единая точка создания, которую подменяют тесты. */
export function createDemoVisionAdapter(targetLabel: string, callbacks: VisionCallbacks): VisionAdapter {
  return new DemoVisionAdapter(targetLabel, callbacks);
}
