import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { createDemoVisionAdapter } from "./demoVisionAdapter";
import {
  detectHands,
  getHandLandmarker,
  measureBrightness,
  onVideoFrames,
} from "../vision/landmarkers";
import {
  createGestureRecognizer,
  pickHand,
  type GestureRecognizerApi,
  type RecognizerOptions,
} from "../vision/recognizer";
import type { Gesture } from "../types/lesson";
import type {
  VisionAdapter,
  VisionCallbacks,
  VisionMode,
} from "../types/vision";

// MediaPipe даёт точки, наш распознаватель — результат, UI получает только callbacks.
export class MediaPipeVisionAdapter implements VisionAdapter {
  readonly mode = "real";
  private readonly options: RecognizerOptions;
  private readonly callbacks: VisionCallbacks;
  private readonly recognizer: GestureRecognizerApi;
  private handLandmarker: HandLandmarker | null = null;
  private stopLoop: (() => void) | null = null;
  private paused = false;
  private lastEmitAt = -Infinity;
  private generation = 0;
  private frameCount = 0;
  private brightness: number | undefined;
  private finished = false;

  constructor(options: RecognizerOptions, callbacks: VisionCallbacks) {
    this.options = options;
    this.callbacks = callbacks;
    // Через фабрику, чтобы тесты могли подставить двойник распознавателя.
    this.recognizer = createGestureRecognizer(options);
  }

  async initialize() {
    this.handLandmarker = await getHandLandmarker();

  }

  async start(video: HTMLVideoElement) {
    this.stop();
    const startGeneration = this.generation;
    if (!this.handLandmarker) await this.initialize();
    if (startGeneration !== this.generation) return;
    this.finished = false;
    this.lastEmitAt = -Infinity;
    this.frameCount = 0;
    this.brightness = undefined;
    this.recognizer.reset();
    this.stopLoop = onVideoFrames(video, () => this.recognizeVideoFrame(video), this.handleLoopError);
  }

  stop() {
    this.generation += 1;
    this.stopLoop?.();
    this.stopLoop = null;
  }

  pause(value: boolean) {
    this.paused = value;
  }

  /** Обработчик ошибок цикла кадров; передаётся как колбэк, поэтому стрелочное поле. */
  private readonly handleLoopError = (error: unknown) => {
    this.stop();
    this.callbacks.onError(error);
  };

  /** Вызывается из цикла кадров; стрелочное поле, чтобы сохранить `this`. */
  private readonly recognizeVideoFrame = (video: HTMLVideoElement) => {
    if (this.paused || this.finished || !this.handLandmarker) return;
    const now = performance.now();
    this.frameCount += 1;
    // 1. MediaPipe: видео → 21 точка руки.
    const hands = detectHands(this.handLandmarker, video);
    if (this.frameCount % 30 === 1) this.brightness = measureBrightness(video);
    const chosen = pickHand(hands, this.options.dominantHand);
    // 2. Наш код: нормализация → признаки → сравнение → ошибки → удержание.
    const result = this.recognizer.recognizeFrame({
      t: now,
      hands,
      brightness: this.brightness,
    });
    // 3. Точки рисуем каждый кадр, текст и прогресс обновляем максимум 10 раз/с.
    if (result.status === "success" || now - this.lastEmitAt >= 100) {
      this.lastEmitAt = now;
      this.callbacks.onResult(result);
    }
    // Publish semantics first so the final canvas frame uses the success colors.
    this.callbacks.onFrame(chosen?.image ?? []);
    if (result.status === "success") {
      this.finished = true;
      this.stop();
    }
  };
}

/** Создаёт MediaPipe-адаптер; точка создания, которую подменяют тесты. */
export function createMediaPipeVisionAdapter(options: RecognizerOptions, callbacks: VisionCallbacks): VisionAdapter {
  return new MediaPipeVisionAdapter(options, callbacks);
}

/** Picks the adapter: demo only in development, otherwise MediaPipe. */
export function createVisionAdapter(
  gesture: Gesture,
  mode: VisionMode,
  callbacks: VisionCallbacks,
  options?: Omit<RecognizerOptions, "targetId" | "targetLabel">,
): VisionAdapter {
  if (mode === "demo" && import.meta.env.DEV) return createDemoVisionAdapter(gesture.label, callbacks);
  return createMediaPipeVisionAdapter({
    labels: {}, staticModels: new Map(), dominantHand: "right",
    ...options,
    diagnostics: import.meta.env.DEV,
    targetId: gesture.id, targetLabel: gesture.label,
  }, callbacks);
}
