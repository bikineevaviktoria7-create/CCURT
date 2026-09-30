// Pure data types for the recognition pipeline. No DOM, no MediaPipe imports:
// everything in src/vision/*.ts (except landmarkers.ts) is testable with node --test.

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

/** One recorded reference example of a gesture. */
export interface GestureSample {
  id: string;
  gestureId: string;
  /** Static gestures: hand-shape feature vector. */
  features?: number[];
  /** Dynamic gestures: one motion feature vector per frame (already resampled). */
  sequence?: number[][];
  /** Dynamic gestures: recording duration, used for speed hints. */
  durationMs?: number;
  /** Explicit coordinate convention used while recording; never infer it from the word. */
  coordinateSpace?: "frame" | "body";
  /** Raw landmarks so features can be recomputed if the algorithm changes. */
  landmarks?: unknown;
  handedness?: Hand;
  featureVersion: number;
  createdAt?: string;
}

/** Everything the matcher needs to know about one analysed frame of a hand. */
export interface HandObservation {
  /** 21 image-space points, 0–1, not mirrored. */
  image: readonly Point3[];
  /** 21 world-space points in metres (MediaPipe worldLandmarks). */
  world: readonly Point3[];
  hand: Hand;
  /** MediaPipe handedness score, 0–1. */
  score: number;
}
