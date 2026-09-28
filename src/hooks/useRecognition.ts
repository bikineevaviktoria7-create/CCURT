import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  MockVisionAdapter,
  initialRecognition,
} from "../integrations/visionAdapter";
import { drawHandSkeleton } from "../lib/drawHandSkeleton";
import type { Gesture } from "../types/lesson";
import type { GestureAttempt } from "../types/progress";
import type { GestureErrorCode, RecognitionStatus } from "../types/vision";

export function useRecognition(
  gesture: Gesture,
  video: RefObject<HTMLVideoElement>,
  canvas: RefObject<HTMLCanvasElement>,
  onSuccess: (attempt: GestureAttempt) => void,
  paused: boolean,
) {
  const [result, setResult] = useState(() => initialRecognition(gesture.label));
  const [running, setRunning] = useState(false);
  const [modelError, setModelError] = useState(false);
  const adapter = useRef<MockVisionAdapter | null>(null);
  const lastResult = useRef(result);
  const errors = useRef<GestureErrorCode[]>([]);
  const callback = useRef(onSuccess);
  callback.current = onSuccess;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const startedAt = useRef(Date.now());
  useEffect(() => {
    const vision = new MockVisionAdapter(gesture.label);
    adapter.current = vision;
    let active = true;
    let accepted = false;
    let lastError = "";
    errors.current = [];
    startedAt.current = Date.now();
    const initial = initialRecognition(gesture.label);
    lastResult.current = initial;
    setResult(initial);
    setModelError(false);
    const style = getComputedStyle(document.documentElement);
    const colors = {
      neutral: style.getPropertyValue("--color-skeleton-neutral").trim(),
      correct: style.getPropertyValue("--color-skeleton-correct").trim(),
      incorrect: style.getPropertyValue("--color-skeleton-incorrect").trim(),
    };
    const unsubscribe = vision.subscribe((next) => {
      if (!active) return;
      lastResult.current = next;
      setResult(next);
      const key = next.errorCodes?.join() ?? "";
      if (key && key !== lastError)
        errors.current.push(...(next.errorCodes ?? []));
      lastError = key;
      if (next.status === "success" && !accepted) {
        accepted = true;
        callback.current({
          gestureId: gesture.id,
          success: true,
          skipped: false,
          confidence: next.confidence,
          errorCodes: [...errors.current],
          durationMs: Date.now() - startedAt.current,
        });
      }
    });
    const unsubscribeFrames = vision.subscribeFrames((frame) => {
      const element = canvas.current;
      const ctx = element?.getContext("2d");
      if (!element || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const width = element.clientWidth * dpr,
        height = element.clientHeight * dpr;
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      drawHandSkeleton({
        ctx,
        landmarks: frame.landmarks,
        width,
        height,
        mirrored: true,
        colors,
        sourceWidth: video.current?.videoWidth || 640,
        sourceHeight: video.current?.videoHeight || 480,
        incorrectLandmarks: lastResult.current.incorrectLandmarks,
        correctLandmarks: lastResult.current.correctLandmarks,
      });
    });
    const element = canvas.current;
    element?.getContext("2d")?.clearRect(0, 0, element.width, element.height);
    if (running && video.current) {
      void vision
        .initialize()
        .then(async () => {
          if (active && video.current) {
            await vision.start();
            vision.pause(pausedRef.current);
          }
        })
        .catch(() => {
          if (active) {
            vision.stop();
            setModelError(true);
          }
        });
    }
    return () => {
      active = false;
      vision.stop();
      unsubscribe();
      unsubscribeFrames();
    };
  }, [gesture.id, gesture.label, video, canvas, running]);
  useEffect(() => {
    adapter.current?.pause(paused);
  }, [paused]);
  const start = useCallback(() => {
    setModelError(false);
    if (running) adapter.current?.resume();
    else setRunning(true);
  }, [running]);
  return {
    result,
    running,
    modelError,
    start,
    stop: () => adapter.current?.stop(),
    simulate: (status: RecognitionStatus, confidence?: number, hold?: number) =>
      adapter.current?.simulate(status, confidence, hold),
    skippedAttempt: (): GestureAttempt => ({
      gestureId: gesture.id,
      success: false,
      skipped: true,
      errorCodes: [...errors.current],
      durationMs: Date.now() - startedAt.current,
    }),
  };
}
