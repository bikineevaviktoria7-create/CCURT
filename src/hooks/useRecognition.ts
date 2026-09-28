import type { Point3 } from "../vision/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { initialRecognition } from "../integrations/visionAdapter";
import {
  createVisionAdapter,
} from "../integrations/mediaPipeVisionAdapter";
import type { RecognizerOptions } from "../vision/recognizer";
import { createSkeletonOverlay } from "../lib/drawHandSkeleton";
import type { Gesture } from "../types/lesson";
import type { GestureAttempt } from "../types/progress";
import type {
  VisionAdapter,
  RecognitionResult,
  GestureErrorCode,
  RecognitionStatus,
  VisionMode,
} from "../types/vision";

export type RecognitionConfig = {
  mode: VisionMode;
  enabled?: boolean;
  targetKey?: string | number;
  options?: Omit<RecognizerOptions, "targetId" | "targetLabel" | "targetKind">;
};

export function useRecognition(
  gesture: Gesture,
  video: RefObject<HTMLVideoElement>,
  canvas: RefObject<HTMLCanvasElement>,
  onSuccess: (attempt: GestureAttempt) => void,
  paused: boolean,
  config: RecognitionConfig,
) {
  const [result, setResult] = useState(() => initialRecognition(gesture.label));
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState(false);
  const adapter = useRef<VisionAdapter | null>(null);
  const { mode, options, enabled = true, targetKey = gesture.id } = config;
  const errors = useRef<GestureErrorCode[]>([]);
  const callback = useRef(onSuccess);
  callback.current = onSuccess;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const startedAt = useRef(Date.now());
  // Switching between the demo and the camera always waits for an explicit start,
  // so a missing sample never silently "passes" a gesture through the demo.
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
    setResult(initial);
    setModelError(false);
    function showModelError() {
      if (!active) return;
      vision.stop();
      setModelError(true);
      setModelLoading(false);
    }
    const skeleton = createSkeletonOverlay(video.current, canvas.current);
    function showResult(next: RecognitionResult) {
      if (!active) return;
      lastResult = next;
      setResult(next);
      const key = next.errorCodes?.join() ?? "";
      if (key && key !== lastError)
        errors.current.push(...(next.errorCodes ?? []));
      lastError = key;
      if (next.status === "success" && !accepted) {
        accepted = true;
        callback.current({
          gestureId: gesture.id,
          mode: vision.mode,
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
    const vision = createVisionAdapter(gesture, mode, {
      onResult: showResult, onFrame: drawFrame, onError: showModelError,
    }, options);
    adapter.current = vision;
    setModelLoading(running && enabled);
    if (running && enabled && video.current) {
      void vision
        .initialize()
        .then(async () => {
          if (active && video.current) {
            vision.pause(pausedRef.current);
            await vision.start(video.current);
            if (!active) {
              vision.stop();
              return;
            }
            vision.pause(pausedRef.current);
            setModelLoading(false);
          }
        })
        .catch(showModelError);
    }
    return () => {
      active = false;
      vision.stop();
      skeleton?.dispose();
    };
    // The step key also resets consecutive occurrences of the same letter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture.id, gesture.label, gesture.kind, video, canvas, running, runId, mode, options, enabled, targetKey]);
  useEffect(() => {
    adapter.current?.pause(paused);
  }, [paused]);
  const start = useCallback(() => {
    adapter.current?.stop();
    setModelError(false);
    setRunning(true);
    setRunId((id) => id + 1);
  }, []);
  return {
    result,
    running,
    modelError,
    modelLoading,
    start,
    stop: () => adapter.current?.stop(),
    canSimulate: mode === "demo",
    simulate: (status: RecognitionStatus, confidence?: number, hold?: number) =>
      adapter.current?.simulate?.(status, confidence, hold),
    skippedAttempt: (): GestureAttempt => ({
      gestureId: gesture.id,
      mode: adapter.current?.mode ?? "demo",
      success: false,
      skipped: true,
      errorCodes: [...errors.current],
      durationMs: Date.now() - startedAt.current,
    }),
  };
}
