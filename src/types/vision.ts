import type { Point3 } from "../vision/types";

export type RecognitionStatus =
  | 'idle'
  | 'searching'
  | 'almost'
  | 'success'
  | 'incorrect'
  | 'environment-error';

export type GestureErrorCode =
  | 'FINGER_NOT_BENT'
  | 'FINGER_NOT_STRAIGHT'
  | 'THUMB_POSITION'
  | 'FINGER_SPREAD'
  | 'PALM_ORIENTATION'
  | 'HAND_LOCATION'
  | 'AMPLITUDE'
  | 'SPEED'
  | 'HAND_OUT_OF_FRAME'
  | 'LOW_LIGHT'
  | 'WRONG_HAND'
  | 'WRONG_GESTURE';

export interface RecognitionResult {
  status: RecognitionStatus;
  predictedGesture?: string;
  targetGesture: string;
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

export type VisionMode = 'real' | 'demo';
