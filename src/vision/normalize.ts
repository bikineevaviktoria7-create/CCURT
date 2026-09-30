import type { FingerName, Hand, Point3 } from "./types.ts";

export const WRIST = 0;

/** Landmark chains: wrist → base → … → tip. */
export const FINGER_CHAINS: Record<FingerName, readonly number[]> = {
  thumb: [0, 1, 2, 3, 4],
  index: [0, 5, 6, 7, 8],
  middle: [0, 9, 10, 11, 12],
  ring: [0, 13, 14, 15, 16],
  pinky: [0, 17, 18, 19, 20],
};

/** Landmarks to highlight on the skeleton for each finger (without the wrist). */
export const FINGER_LANDMARKS: Record<FingerName, readonly number[]> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

export const PALM_LANDMARKS: readonly number[] = [0, 5, 9, 13, 17];

export const FINGERS: readonly FingerName[] = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky",
];

/** Vector from `b` to `a`. */
export function sub(a: Point3, b: Point3): Point3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}
/** Dot product of two vectors. */
export function dot(a: Point3, b: Point3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
/** Cross product of two vectors. */
export function cross(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
/** Euclidean length of a vector. */
export function length(a: Point3) {
  return Math.sqrt(dot(a, a));
}
/** Euclidean distance between two points. */
export function distance(a: Point3, b: Point3) {
  return length(sub(a, b));
}
/** Vector of length 1 in the same direction; a zero vector stays zero. */
export function unit(a: Point3): Point3 {
  const size = length(a) || 1;
  return { x: a.x / size, y: a.y / size, z: a.z / size };
}
/** Angle between two vectors in radians, 0…π. */
export function angleBetween(a: Point3, b: Point3) {
  const size = length(a) * length(b);
  if (!size) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / size)));
}

/**
 * MediaPipe labels handedness assuming a mirrored (selfie) image. We feed the
 * raw, non-mirrored camera frame, so its labels are swapped. This is the only
 * place that knows about it.
 */
export function resolveHandedness(label: string | undefined): Hand {
  return label?.toLowerCase() === "left" ? "right" : "left";
}

/**
 * Translates the hand so the wrist is at the origin, scales it so the palm
 * (wrist → middle finger base) has length 1 and mirrors a left hand so that
 * both hands share one set of reference samples.
 */
export function normalizeHand(landmarks: readonly Point3[], hand: Hand): Point3[] {
  const wrist = landmarks[WRIST];
  const middleBase = landmarks[9];
  if (!wrist || !middleBase || landmarks.length < 21)
    throw new Error("Ожидается 21 точка руки");
  const scale = distance(wrist, middleBase) || 1;
  const mirror = hand === "left" ? -1 : 1;
  return landmarks.map((point) => ({
    x: ((point.x - wrist.x) / scale) * mirror,
    y: (point.y - wrist.y) / scale,
    z: (point.z - wrist.z) / scale,
  }));
}

/** Point by landmark index; missing points read as the origin. */
export function point(landmarks: readonly Point3[], index: number): Point3 {
  return landmarks[index] ?? { x: 0, y: 0, z: 0 };
}
