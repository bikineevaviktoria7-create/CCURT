import type { Point3 } from "../vision/types";

export type RecognitionStatus =
  | "idle"
  | "searching"
  | "almost"
  | "success"
  | "incorrect"
  | "environment-error";

export type GestureErrorCode =
  | "FINGER_NOT_BENT"
  | "FINGER_NOT_STRAIGHT"
  | "THUMB_POSITION"
  | "FINGER_SPREAD"
  | "PALM_ORIENTATION"
  | "HAND_LOCATION"
  | "AMPLITUDE"
  | "SPEED"
  | "HAND_OUT_OF_FRAME"
  | "LOW_LIGHT"
  | "WRONG_HAND"
  | "WRONG_GESTURE"
  // Оставлены только для чтения старых результатов; текущее распознавание их не выдаёт.
  | "START_POSITION" | "END_POSITION" | "WRONG_DIRECTION"
  | "AMPLITUDE_TOO_SMALL" | "AMPLITUDE_TOO_LARGE"
  | "TOO_FAST" | "TOO_SLOW" | "TRAJECTORY_MISMATCH"
  | "HAND_SHAPE_CHANGED" | "INCOMPLETE_MOVEMENT" | "MOVEMENT_MISMATCH";

export interface StaticDiagnostics {
  targetId: string;
  sampleCount: number;
  distance: number;
  threshold: number;
  nearestGestureId: string;
  rivalDistance?: number;
  matched: boolean;
}

export interface RecognitionResult {
  referenceIssue?: "missing";
  diagnostics?: StaticDiagnostics;
  status: RecognitionStatus;
  predictedLabel?: string;
  targetLabel: string;
  confidence: number;
  holdProgress: number;
  message?: string;
  errorCodes?: readonly GestureErrorCode[];
  incorrectLandmarks?: readonly number[];
  correctLandmarks?: readonly number[];
}

// Кадры идут прямо в canvas, результаты — в React с ограничением частоты.
export interface VisionCallbacks {
  onResult(result: RecognitionResult): void;
  onFrame(landmarks: readonly Point3[]): void;
  onError(error: unknown): void;
}

export interface VisionAdapter {
  readonly mode: VisionMode;
  initialize(): Promise<void>;
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  pause(paused: boolean): void;
  simulate?(status: RecognitionStatus, confidence?: number, holdProgress?: number): void;
}

export type VisionMode = "real" | "demo";
