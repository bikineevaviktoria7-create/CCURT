import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { initialRecognition } from "../integrations/demoVisionAdapter";
import { createVisionAdapter } from "../integrations/mediaPipeVisionAdapter";
import { createSkeletonOverlay } from "../lib/drawHandSkeleton";
import { initialFeedback, updateFeedback } from "../lib/feedbackHistory";
import { useLatestRef } from "./useLatestRef";
import { hasModel, type RecognizerOptions } from "../vision/recognizer";
import type { Point3 } from "../vision/types";
import type { Gesture } from "../types/lesson";
import type { GestureAttempt } from "../types/progress";
import type {
  VisionAdapter,
  RecognitionResult,
  GestureErrorCode,
  RecognitionStatus,
  VisionMode,
} from "../types/vision";

/** Настройки распознавания одного упражнения; новый `targetKey` перезапускает распознавание. */
export interface RecognitionConfig {
  mode: VisionMode;
  enabled?: boolean;
  targetKey?: string | number;
  options?: Omit<RecognizerOptions, "targetId" | "targetLabel">;
}

/** Запускает распознавание по видео с камеры: результаты идут в React, точки руки — в canvas. */
export function useRecognition(
  gesture: Gesture,
  video: RefObject<HTMLVideoElement>,
  canvas: RefObject<HTMLCanvasElement>,
  onSuccess: (attempt: GestureAttempt) => void,
  paused: boolean,
  config: RecognitionConfig,
) {
  const [result, setResult] = useState(() => initialRecognition(gesture.label));
  const [presentation, setPresentation] = useState(() => initialFeedback(result));
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState(false);
  const adapterRef = useRef<VisionAdapter | null>(null);
  const { mode, options, enabled = true, targetKey = gesture.id } = config;
  const errors = useRef<GestureErrorCode[]>([]);
  const callback = useLatestRef(onSuccess);
  const pausedRef = useLatestRef(paused);
  const startedAt = useRef(Date.now());
  // Переключение между демо и камерой всегда ждёт явного запуска,
  // чтобы при отсутствии эталона жест не «засчитывался» через демо.
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current !== mode) {
      previousMode.current = mode;
      setRunning(false);
    }
  }, [mode]);
  useEffect(() => {
    let active = true;
    let accepted = false;
    let lastError = "";
    errors.current = [];
    startedAt.current = Date.now();
    const initial = initialRecognition(gesture.label);
    let lastResult = initial;
    let feedback = initialFeedback(initial);
    setPresentation(feedback);
    setResult(initial);
    setModelError(false);
    function showModelError() {
      if (!active) return;
      adapter.stop();
      setModelError(true);
      setModelLoading(false);
    }
    const skeleton = createSkeletonOverlay(video.current, canvas.current);
    function showResult(next: RecognitionResult) {
      // Отбрасываем запоздавшие колбэки и кадры на паузе: подготовка не влияет на попытки.
      if (!active || pausedRef.current) return;
      feedback = updateFeedback(feedback, next, performance.now());
      setPresentation(feedback);
      lastResult = feedback.current;
      setResult(next);
      const key = next.errorCodes?.join() ?? "";
      if (key && key !== lastError)
        errors.current.push(...(next.errorCodes ?? []));
      lastError = key;
      if (next.status === "success" && !accepted) {
        accepted = true;
        callback.current({
          gestureId: gesture.id,
          mode: adapter.mode,
          success: true,
          skipped: false,
          confidence: next.confidence,
          errorCodes: [...errors.current],
          durationMs: Date.now() - startedAt.current,
        });
      }
    }
    function drawFrame(landmarks: readonly Point3[]) {
      if (active) skeleton?.draw(landmarks, lastResult);
    }
    const adapter = createVisionAdapter(gesture, mode, {
      onResult: showResult, onFrame: drawFrame, onError: showModelError,
    }, options);
    adapterRef.current = adapter;
    setModelLoading(running && enabled);
    if (running && enabled && video.current) {
      void adapter
        .initialize()
        .then(async () => {
          if (active && video.current) {
            adapter.pause(pausedRef.current);
            await adapter.start(video.current);
            if (!active) {
              adapter.stop();
              return;
            }
            adapter.pause(pausedRef.current);
            setModelLoading(false);
          }
        })
        .catch(showModelError);
    }
    return () => {
      active = false;
      adapter.stop();
      skeleton?.dispose();
    };
    // Ключ шага сбрасывает распознавание и для одной и той же буквы подряд.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture.id, gesture.label, video, canvas, running, runId, mode, options, enabled, targetKey]);
  useEffect(() => {
    adapterRef.current?.pause(paused);
  }, [paused]);
  const start = useCallback(() => {
    adapterRef.current?.stop();
    setModelError(false);
    setRunning(true);
    setRunId((id) => id + 1);
  }, []);
  // Повторяет проверку распознавателя: без эталонов жест можно только изучить, но не оценить.
  const available = (mode === "demo" && import.meta.env.DEV) ||
    options?.exercise === "hand-visibility" ||
    hasModel({ targetId: gesture.id, staticModels: options?.staticModels ?? new Map() });
  return {
    result,
    presentation,
    available,
    running,
    modelError,
    modelLoading,
    start,
    stop: () => adapterRef.current?.stop(),
    canSimulate: mode === "demo",
    simulate: (status: RecognitionStatus, confidence?: number, hold?: number) =>
      adapterRef.current?.simulate?.(status, confidence, hold),
    skippedAttempt: (): GestureAttempt => ({
      gestureId: gesture.id,
      mode: adapterRef.current?.mode ?? "demo",
      success: false,
      skipped: true,
      errorCodes: [...errors.current],
      durationMs: Date.now() - startedAt.current,
    }),
    /** Попытка для жеста без эталонов: изучен по образцу, в оценку не входит. */
    studiedAttempt: (): GestureAttempt => ({
      gestureId: gesture.id,
      mode: adapterRef.current?.mode ?? "demo",
      success: false,
      skipped: false,
      assessed: false,
      errorCodes: [],
      durationMs: Date.now() - startedAt.current,
    }),
  };
}
