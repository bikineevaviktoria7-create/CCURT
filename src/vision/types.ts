// Чистые типы данных конвейера распознавания. Без DOM и без импортов MediaPipe:
// всё в src/vision/*.ts (кроме landmarkers.ts) тестируется через node --test.

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export type Hand = "left" | "right";

export type FeatureGroup =
  | "thumb"
  | "index"
  | "middle"
  | "ring"
  | "pinky"
  | "spread"
  | "orientation";

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

/** Один записанный эталон жеста. */
export interface GestureSample {
  id: string;
  gestureId: string;
  /** Вектор признаков формы руки. */
  features?: number[];
  /** Старые записи движения из базы; распознавание их не использует, такие эталоны отсеиваются. */
  sequence?: number[][];
  /** Длительность записи из базы; распознаванием не используется. */
  durationMs?: number;
  /** Сырые точки, чтобы пересчитать признаки при смене алгоритма. */
  landmarks?: unknown;
  handedness?: Hand;
  featureVersion: number;
  createdAt?: string;
}

/** Всё, что нужно сравнению об одной руке на обработанном кадре. */
export interface HandObservation {
  /** 21 точка в координатах кадра, 0–1, без зеркалирования. */
  image: readonly Point3[];
  /** 21 точка в мировых координатах, в метрах (worldLandmarks MediaPipe). */
  world: readonly Point3[];
  hand: Hand;
  /** Уверенность MediaPipe в определении руки, 0–1. */
  score: number;
}
