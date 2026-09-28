import { createMockVision } from "./visionAdapter";
import type { Gesture } from "../types/lesson";
import {
  detectBody,
  detectHands,
  getHandLandmarker,
  getPoseLandmarker,
  measureBrightness,
  onVideoFrames,
} from "../vision/landmarkers";
import { createGestureRecognizer, pickHand, type RecognizerOptions } from "../vision/recognizer";
import type { BodyReference } from "../vision/types";
import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type {
  VisionAdapter,
  VisionCallbacks,
  VisionMode,
} from "../types/vision";

// MediaPipe даёт точки, наш распознаватель — результат, UI получает только callbacks.
export function createMediaPipeVision(options: RecognizerOptions, callbacks: VisionCallbacks): VisionAdapter {
  const recognizer = createGestureRecognizer(options);
  let hand: HandLandmarker | null = null;
  let pose: PoseLandmarker | null = null;
  let stopLoop: (() => void) | null = null;
  let paused = false;
  let lastEmit = -Infinity;
  let generation = 0;
  let frameCount = 0;
  let brightness: number | undefined;
  let body: BodyReference | undefined;
  let finished = false;

  async function initialize() {
    hand = await getHandLandmarker();
    if (options.targetKind === "dynamic")
      pose = await getPoseLandmarker().catch((error: unknown) => {
        // Body landmarks only refine the location; words still work without them.
        console.warn("[SignStep] модель позы недоступна", error);
        return null;
      });
  }

  async function start(video: HTMLVideoElement) {
    stop();
    const startGeneration = generation;
    if (!hand) await initialize();
    if (startGeneration !== generation) return;
    finished = false;
    lastEmit = -Infinity;
    frameCount = 0;
    body = undefined;
    brightness = undefined;
    recognizer.reset();
    stopLoop = onVideoFrames(video, () => recognizeVideoFrame(video), (error) => {
      stop();
      callbacks.onError(error);
    });
  }

  function stop() {
    generation += 1;
    stopLoop?.();
    stopLoop = null;
  }

  function pause(value: boolean) {
    paused = value;
  }

  function recognizeVideoFrame(video: HTMLVideoElement) {
    if (paused || finished || !hand) return;
    const now = performance.now();
    frameCount += 1;
    // 1. MediaPipe: видео → 21 точка руки.
    const hands = detectHands(hand, video);
    if (frameCount % 30 === 1) brightness = measureBrightness(video);
    if (pose && frameCount % 2 === 0) body = detectBody(pose, video) ?? body;
    const chosen = pickHand(hands, options.dominantHand);
    // 2. Наш код: нормализация → признаки → сравнение → ошибки → удержание.
    const result = recognizer.recognizeFrame({
      t: now,
      hands,
      body,
      brightness,
    });
    // 3. Точки рисуем каждый кадр, текст и прогресс обновляем максимум 10 раз/с.
    if (result.status === "success" || now - lastEmit >= 100) {
      lastEmit = now;
      callbacks.onResult(result);
    }
    // Publish semantics first so the final canvas frame uses the success colors.
    callbacks.onFrame(chosen?.image ?? []);
    if (result.status === "success") {
      finished = true;
      stop();
    }
  }

  return { mode: "real", initialize, start, stop, pause };
}

export function createVisionAdapter(
  gesture: Gesture,
  mode: VisionMode,
  callbacks: VisionCallbacks,
  options?: Omit<RecognizerOptions, "targetId" | "targetLabel" | "targetKind">,
): VisionAdapter {
  if (mode === "demo" && import.meta.env.DEV) return createMockVision(gesture.label, callbacks);
  return createMediaPipeVision({
    labels: {}, staticModels: new Map(), dynamicModels: new Map(), dominantHand: "right",
    ...options,
    targetId: gesture.id, targetLabel: gesture.label, targetKind: gesture.kind,
  }, callbacks);
}
