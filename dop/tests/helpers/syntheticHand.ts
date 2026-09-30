import type { Point3 } from "../../../src/vision/types.ts";

export interface HandPose {
  /** Flexion per joint in radians, 3 joints per finger. */
  thumb?: [number, number, number];
  index?: [number, number, number];
  middle?: [number, number, number];
  ring?: [number, number, number];
  pinky?: [number, number, number];
}

const FINGER_BASES: Record<string, { base: Point3; dir: Point3; lengths: number[] }> = {
  thumb: { base: { x: 0.025, y: -0.02, z: 0 }, dir: { x: 0.6, y: -0.8, z: 0 }, lengths: [0.035, 0.03, 0.025] },
  index: { base: { x: 0.022, y: -0.09, z: 0 }, dir: { x: 0.05, y: -1, z: 0 }, lengths: [0.04, 0.025, 0.022] },
  middle: { base: { x: 0, y: -0.095, z: 0 }, dir: { x: 0, y: -1, z: 0 }, lengths: [0.045, 0.028, 0.024] },
  ring: { base: { x: -0.02, y: -0.09, z: 0 }, dir: { x: -0.05, y: -1, z: 0 }, lengths: [0.042, 0.026, 0.022] },
  pinky: { base: { x: -0.038, y: -0.08, z: 0 }, dir: { x: -0.12, y: -1, z: 0 }, lengths: [0.032, 0.02, 0.018] },
};

/** Deterministic pseudo-random noise. */
export function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296 - 0.5;
  };
}

/** Right hand, palm facing the camera, fingers up (y down, z towards camera < 0). */
export function makeHand(pose: HandPose = {}, noise = 0, seed = 1): Point3[] {
  const random = rng(seed);
  const jitter = (p: Point3): Point3 => ({
    x: p.x + random() * noise,
    y: p.y + random() * noise,
    z: p.z + random() * noise,
  });
  const points: Point3[] = [{ x: 0, y: 0, z: 0 }];
  for (const finger of ["thumb", "index", "middle", "ring", "pinky"] as const) {
    const { base, dir, lengths } = FINGER_BASES[finger]!;
    const flex = pose[finger] ?? [0, 0, 0];
    const size = Math.hypot(dir.x, dir.y) || 1;
    const planar = { x: dir.x / size, y: dir.y / size };
    points.push(jitter(base));
    let current = base;
    let angle = 0;
    for (let joint = 0; joint < 3; joint++) {
      angle += flex[joint] ?? 0;
      // Fingers fold towards the palm side, i.e. towards the camera (−z).
      const step = {
        x: planar.x * Math.cos(angle) * (lengths[joint] ?? 0.02),
        y: planar.y * Math.cos(angle) * (lengths[joint] ?? 0.02),
        z: -Math.sin(angle) * (lengths[joint] ?? 0.02),
      };
      current = { x: current.x + step.x, y: current.y + step.y, z: current.z + step.z };
      points.push(jitter(current));
    }
  }
  return points;
}

/** Scales and shifts every point of the hand. */
export function transform(points: Point3[], scale: number, offset: Point3): Point3[] {
  return points.map((p) => ({ x: p.x * scale + offset.x, y: p.y * scale + offset.y, z: p.z * scale + offset.z }));
}

/** Mirrors the hand along x, turning a right hand into a left one. */
export function mirror(points: Point3[]): Point3[] {
  return points.map((p) => ({ x: -p.x, y: p.y, z: p.z }));
}

/** Image-space version of a world hand, centred in the frame. */
export function toImage(points: Point3[], center = { x: 0.5, y: 0.6 }): Point3[] {
  return points.map((p) => ({ x: center.x + p.x * 2.2, y: center.y + p.y * 2.2, z: p.z }));
}

/** Ready-made poses for the synthetic hand. */
export const OPEN: HandPose = {};
export const FIST: HandPose = {
  thumb: [0.4, 0.5, 0.4],
  index: [1.5, 1.4, 0.8],
  middle: [1.5, 1.4, 0.8],
  ring: [1.5, 1.4, 0.8],
  pinky: [1.5, 1.4, 0.8],
};
export const PINKY_BENT: HandPose = { pinky: [1.5, 1.4, 0.8] };
export const V_SIGN: HandPose = {
  thumb: [0.4, 0.5, 0.4],
  ring: [1.5, 1.4, 0.8],
  pinky: [1.5, 1.4, 0.8],
};
