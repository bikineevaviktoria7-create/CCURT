import type { GestureErrorCode } from "../types/vision.ts";
import { fingerFlexion, readVector } from "./features.ts";
import { hints } from "./hints.ts";
import { FINGER_LANDMARKS, FINGERS, PALM_LANDMARKS } from "./normalize.ts";
import type { BodyReference, GestureSample, Hand, Point3 } from "./types.ts";

// Dynamic gestures (words, letters with movement): a short recording of the hand
// is turned into a sequence of small motion vectors and compared with the team's
// samples using Dynamic Time Warping, which tolerates different speeds.

export const SEQUENCE_LENGTH = 24;
/** Per-frame layout: location x, y · flexion of 5 fingers · palm facing (normal.z). */
const WEIGHTS = [1.6, 1.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.5];
export const MOTION_FEATURE_COUNT = WEIGHTS.length;

export const MIN_DYNAMIC_ACCEPT = 0.12;
export const MAX_DYNAMIC_ACCEPT = 0.45;
export const DEFAULT_DYNAMIC_ACCEPT = 0.25;

export interface MotionFrame {
  vector: number[];
  t: number;
}

/**
 * Location of the wrist relative to the body. With pose landmarks: relative to the
 * nose, in shoulder widths. Without: relative to the frame centre, in palm sizes.
 */
export function handLocation(
  image: readonly Point3[],
  hand: Hand,
  body?: BodyReference,
): { x: number; y: number } {
  const wrist = image[0] ?? { x: 0.5, y: 0.5, z: 0 };
  const mirror = hand === "left" ? -1 : 1;
  if (body) {
    const shoulders =
      Math.hypot(
        body.leftShoulder.x - body.rightShoulder.x,
        body.leftShoulder.y - body.rightShoulder.y,
      ) || 0.25;
    return {
      x: ((wrist.x - body.nose.x) / shoulders) * mirror,
      y: (wrist.y - body.nose.y) / shoulders,
    };
  }
  const middle = image[9] ?? wrist;
  const palm = Math.hypot(middle.x - wrist.x, middle.y - wrist.y) || 0.1;
  return {
    x: ((wrist.x - 0.5) / (palm * 4)) * mirror,
    y: (wrist.y - 0.5) / (palm * 4),
  };
}

export function motionVector(
  handFeatures: readonly number[],
  location: { x: number; y: number },
): number[] {
  return [
    location.x,
    location.y,
    ...FINGERS.map((finger) => fingerFlexion(handFeatures, finger)),
    readVector(handFeatures, "orientation.normal").z,
  ];
}

/** Linear resampling to a fixed number of frames. */
export function resample(sequence: readonly number[][], size = SEQUENCE_LENGTH) {
  if (!sequence.length) return [];
  if (sequence.length === 1) return Array.from({ length: size }, () => [...(sequence[0] ?? [])]);
  return Array.from({ length: size }, (_, index) => {
    const position = (index / (size - 1)) * (sequence.length - 1);
    const low = Math.floor(position);
    const high = Math.min(sequence.length - 1, low + 1);
    const t = position - low;
    const a = sequence[low] ?? [];
    const b = sequence[high] ?? a;
    return a.map((value, dimension) => value * (1 - t) + (b[dimension] ?? value) * t);
  });
}

function frameDistance(a: readonly number[], b: readonly number[]) {
  let sum = 0;
  for (let index = 0; index < WEIGHTS.length; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    sum += (WEIGHTS[index] ?? 1) * difference * difference;
  }
  return Math.sqrt(sum / WEIGHTS.length);
}

/** DTW with a Sakoe–Chiba band, normalised by the length of the warping path. */
export function dtwDistance(
  a: readonly number[][],
  b: readonly number[][],
  band = Math.ceil(SEQUENCE_LENGTH * 0.25),
) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return Infinity;
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const steps = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  cost[0]![0] = 0;
  const window = Math.max(band, Math.abs(n - m));
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(1, i - window); j <= Math.min(m, i + window); j++) {
      const d = frameDistance(a[i - 1] ?? [], b[j - 1] ?? []);
      const options: [number, number][] = [
        [cost[i - 1]![j]!, steps[i - 1]![j]!],
        [cost[i]![j - 1]!, steps[i]![j - 1]!],
        [cost[i - 1]![j - 1]!, steps[i - 1]![j - 1]!],
      ];
      const [best, count] = options.reduce((x, y) => (y[0] < x[0] ? y : x));
      cost[i]![j] = best + d;
      steps[i]![j] = count + 1;
    }
  }
  return cost[n]![m]! / (steps[n]![m]! || 1);
}

export interface DynamicGestureModel {
  gestureId: string;
  samples: { sequence: number[][]; durationMs: number }[];
  acceptDistance: number;
}

export function buildDynamicModels(samples: readonly GestureSample[]) {
  const byGesture = new Map<string, DynamicGestureModel["samples"]>();
  for (const sample of samples) {
    if (!sample.sequence?.length) continue;
    const list = byGesture.get(sample.gestureId) ?? [];
    list.push({
      sequence: resample(sample.sequence),
      durationMs: sample.durationMs ?? 1500,
    });
    byGesture.set(sample.gestureId, list);
  }
  const models = new Map<string, DynamicGestureModel>();
  for (const [gestureId, list] of byGesture) {
    let acceptDistance = DEFAULT_DYNAMIC_ACCEPT;
    if (list.length >= 2) {
      const nearest = list.map((sample, index) =>
        Math.min(
          ...list
            .filter((_, other) => other !== index)
            .map((other) => dtwDistance(sample.sequence, other.sequence)),
        ),
      );
      const average = nearest.reduce((sum, value) => sum + value, 0) / nearest.length;
      acceptDistance = Math.min(
        MAX_DYNAMIC_ACCEPT,
        Math.max(MIN_DYNAMIC_ACCEPT, average * 2.2),
      );
    }
    models.set(gestureId, { gestureId, samples: list, acceptDistance });
  }
  return models;
}

export function distanceToDynamicModel(
  sequence: readonly number[][],
  model: DynamicGestureModel,
) {
  const input = resample(sequence);
  let best = Infinity;
  let reference = model.samples[0];
  for (const sample of model.samples) {
    const value = dtwDistance(input, sample.sequence);
    if (value < best) {
      best = value;
      reference = sample;
    }
  }
  return { distance: best, reference };
}

function pathLength(sequence: readonly number[][]) {
  let total = 0;
  for (let index = 1; index < sequence.length; index++) {
    const a = sequence[index - 1] ?? [];
    const b = sequence[index] ?? [];
    total += Math.hypot((b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0));
  }
  return total;
}

function average(sequence: readonly number[][], dimension: number) {
  return (
    sequence.reduce((sum, frame) => sum + (frame[dimension] ?? 0), 0) /
    (sequence.length || 1)
  );
}

export interface DynamicAnalysis {
  errorCodes: GestureErrorCode[];
  message?: string;
  incorrectLandmarks: number[];
}

/** Explains why a movement did not match: location, amplitude, speed or hand-shape. */
export function analyzeDynamic(
  sequence: readonly number[][],
  durationMs: number,
  model: DynamicGestureModel,
): DynamicAnalysis {
  const input = resample(sequence);
  const { reference } = distanceToDynamicModel(sequence, model);
  if (!reference) return { errorCodes: [], incorrectLandmarks: [] };
  const target = reference.sequence;
  const candidates: { score: number; code: GestureErrorCode; message: string; landmarks: number[] }[] = [];
  const dx = average(input, 0) - average(target, 0);
  const dy = average(input, 1) - average(target, 1);
  const offset = Math.hypot(dx, dy);
  if (offset > 0.35) {
    const direction =
      Math.abs(dy) >= Math.abs(dx)
        ? dy > 0
          ? "выше"
          : "ниже"
        : "ближе к центру тела";
    candidates.push({
      score: offset / 0.35,
      code: "HAND_LOCATION",
      message: hints.handLocation(direction),
      landmarks: [0],
    });
  }
  const amplitude = pathLength(input) / (pathLength(target) || 0.01);
  if (amplitude < 0.55)
    candidates.push({ score: 0.55 / Math.max(amplitude, 0.05), code: "AMPLITUDE", message: hints.moveWider(), landmarks: [0] });
  else if (amplitude > 1.9)
    candidates.push({ score: amplitude / 1.9, code: "AMPLITUDE", message: hints.moveSmaller(), landmarks: [0] });
  const speed = reference.durationMs / (durationMs || 1);
  if (speed > 1.8)
    candidates.push({ score: speed / 1.8, code: "SPEED", message: hints.moveSlower(), landmarks: [0] });
  else if (speed < 0.45)
    candidates.push({ score: 0.45 / speed, code: "SPEED", message: hints.moveFaster(), landmarks: [0] });
  FINGERS.forEach((finger, index) => {
    const difference = average(input, 2 + index) - average(target, 2 + index);
    if (Math.abs(difference) > 0.14)
      candidates.push({
        score: Math.abs(difference) / 0.14,
        code: difference < 0 ? "FINGER_NOT_BENT" : "FINGER_NOT_STRAIGHT",
        message: difference < 0 ? hints.bendFinger(finger) : hints.straightenFinger(finger),
        landmarks: [...FINGER_LANDMARKS[finger]],
      });
  });
  const facing = average(input, 7) - average(target, 7);
  if (Math.abs(facing) > 0.6)
    candidates.push({
      score: Math.abs(facing) / 0.6,
      code: "PALM_ORIENTATION",
      message: hints.turnPalm(
        average(target, 7) < -0.3 ? "к камере" : average(target, 7) > 0.3 ? "тыльной стороной к камере" : "ребром к камере",
        "повёрнута иначе",
      ),
      landmarks: [...PALM_LANDMARKS],
    });
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 2);
  return {
    errorCodes: [...new Set(top.map((item) => item.code))],
    message: top[0]?.message,
    incorrectLandmarks: [...new Set(top.flatMap((item) => item.landmarks))],
  };
}

/**
 * Cuts a gesture out of a continuous stream: starts when the hand moves,
 * stops when it rests again, leaves the frame or the time runs out.
 */
export class MotionSegmenter {
  private frames: MotionFrame[] = [];
  private startedAt = 0;
  private stillSince = 0;
  private lostSince = 0;
  private last: MotionFrame | undefined;
  recording = false;

  static readonly START_SPEED = 0.9;
  static readonly STILL_SPEED = 0.35;
  static readonly MAX_MS = 2600;
  static readonly MIN_MS = 600;

  reset() {
    this.frames = [];
    this.recording = false;
    this.last = undefined;
    this.stillSince = 0;
    this.lostSince = 0;
  }

  /** Returns a finished recording or undefined while still collecting. */
  push(frame: MotionFrame | undefined, now: number) {
    if (!frame) {
      if (!this.recording) {
        this.last = undefined;
        return undefined;
      }
      this.lostSince ||= now;
      if (now - this.lostSince > 300) return this.finish(now);
      return undefined;
    }
    this.lostSince = 0;
    const previous = this.last;
    this.last = frame;
    const seconds = previous ? Math.max(0.016, (frame.t - previous.t) / 1000) : 1;
    const speed = previous
      ? Math.hypot(
          (frame.vector[0] ?? 0) - (previous.vector[0] ?? 0),
          (frame.vector[1] ?? 0) - (previous.vector[1] ?? 0),
        ) / seconds
      : 0;
    if (!this.recording) {
      if (speed < MotionSegmenter.START_SPEED) return undefined;
      this.recording = true;
      this.startedAt = previous?.t ?? frame.t;
      this.frames = previous ? [previous] : [];
    }
    this.frames.push(frame);
    const elapsed = frame.t - this.startedAt;
    if (speed < MotionSegmenter.STILL_SPEED) this.stillSince ||= frame.t;
    else this.stillSince = 0;
    if (
      elapsed >= MotionSegmenter.MAX_MS ||
      (elapsed >= MotionSegmenter.MIN_MS && this.stillSince && frame.t - this.stillSince > 350)
    )
      return this.finish(frame.t);
    return undefined;
  }

  progress(now: number) {
    return this.recording
      ? Math.min(1, (now - this.startedAt) / MotionSegmenter.MAX_MS)
      : 0;
  }

  private finish(now: number) {
    const frames = this.frames;
    const durationMs = (frames.at(-1)?.t ?? now) - this.startedAt;
    this.reset();
    if (durationMs < MotionSegmenter.MIN_MS * 0.7 || frames.length < 5) return undefined;
    return { sequence: frames.map((frame) => frame.vector), durationMs };
  }
}
