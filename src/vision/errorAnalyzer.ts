import type { GestureErrorCode } from "../types/vision.ts";
import {
  FEATURE_GROUPS,
  featureIndex,
  fingerFlexion,
  readVector,
} from "./features.ts";
import { hints, PAIR_FINGERS, type FingerPair } from "./hints.ts";
import { FINGER_LANDMARKS, FINGERS, PALM_LANDMARKS } from "./normalize.ts";
import {
  groupDeviation,
  nearestSample,
  type StaticGestureModel,
} from "./staticMatcher.ts";
import type { FeatureGroup, FingerName, Point3 } from "./types.ts";

// Сравниваем каждый палец с эталоном. Самое значимое отклонение превращаем в подсказку.

export interface Issue {
  group: FeatureGroup;
  /** Deviation divided by the group's tolerance; > 1 means a mistake. */
  ratio: number;
  code: GestureErrorCode;
  message: string;
  landmarks: number[];
}

export interface Analysis {
  issues: Issue[];
  errorCodes: GestureErrorCode[];
  message?: string;
  incorrectLandmarks: number[];
  correctLandmarks: number[];
}

const isFinger = (group: FeatureGroup): group is FingerName =>
  (FINGERS as readonly string[]).includes(group);

function flexState(value: number): "straight" | "half" | "bent" {
  return value < 0.15 ? "straight" : value > 0.4 ? "bent" : "half";
}

function fingerIssue(
  finger: FingerName,
  input: readonly number[],
  reference: readonly number[],
): Pick<Issue, "code" | "message"> {
  const difference = fingerFlexion(input, finger) - fingerFlexion(reference, finger);
  if (difference < -0.05)
    return { code: "FINGER_NOT_BENT", message: hints.bendFinger(finger) };
  if (difference > 0.05)
    return { code: "FINGER_NOT_STRAIGHT", message: hints.straightenFinger(finger) };
  const state = flexState(fingerFlexion(reference, finger));
  return {
    code: state === "straight" ? "FINGER_NOT_STRAIGHT" : "FINGER_NOT_BENT",
    message: hints.fingerShape(finger, state),
  };
}

const value = (features: readonly number[], key: string) =>
  features[featureIndex(key)] ?? 0;

function thumbIssue(
  input: readonly number[],
  reference: readonly number[],
): Pick<Issue, "code" | "message"> {
  const touchReference = value(reference, "thumb.tipTo8");
  const touchInput = value(input, "thumb.tipTo8");
  if (touchReference < 0.2 && touchInput > touchReference + 0.08)
    return { code: "THUMB_POSITION", message: hints.touchThumbIndex() };
  if (touchReference > 0.3 && touchInput < 0.18)
    return { code: "THUMB_POSITION", message: hints.releaseThumbIndex() };
  const palmReference = value(reference, "thumb.tipTo9");
  const palmInput = value(input, "thumb.tipTo9");
  if (palmInput > palmReference + 0.06)
    return { code: "THUMB_POSITION", message: hints.thumbToPalm() };
  if (palmInput < palmReference - 0.06)
    return { code: "THUMB_POSITION", message: hints.thumbAway() };
  return { ...fingerIssue("thumb", input, reference), code: "THUMB_POSITION" };
}

const PAIRS: readonly FingerPair[] = [
  "thumb-index",
  "index-middle",
  "middle-ring",
  "ring-pinky",
];
const CONTACT_PAIR: Record<string, FingerPair> = {
  "8-12": "index-middle",
  "12-16": "middle-ring",
  "16-20": "ring-pinky",
};

function spreadIssue(
  input: readonly number[],
  reference: readonly number[],
): Pick<Issue, "code" | "message" | "landmarks"> {
  let worst: { pair: FingerPair; difference: number } = {
    pair: "index-middle",
    difference: 0,
  };
  for (const pair of PAIRS) {
    const difference =
      value(input, `spread.${pair}`) - value(reference, `spread.${pair}`);
    if (Math.abs(difference) > Math.abs(worst.difference)) worst = { pair, difference };
  }
  for (const [key, pair] of Object.entries(CONTACT_PAIR)) {
    const difference =
      value(input, `spread.contact${key}`) - value(reference, `spread.contact${key}`);
    if (Math.abs(difference) > Math.abs(worst.difference)) worst = { pair, difference };
  }
  const [a, b] = PAIR_FINGERS[worst.pair];
  return {
    code: "FINGER_SPREAD",
    message:
      worst.difference < 0
        ? hints.spreadWider(worst.pair)
        : hints.closeTogether(worst.pair),
    landmarks: [...FINGER_LANDMARKS[a], ...FINGER_LANDMARKS[b]],
  };
}

function directionTitle(vector: Point3) {
  const x = Math.abs(vector.x);
  const y = Math.abs(vector.y);
  const z = Math.abs(vector.z);
  if (y >= x && y >= z) return vector.y < 0 ? "вверх" : "вниз";
  if (z >= x) return vector.z < 0 ? "к камере" : "от камеры";
  return "в сторону";
}

/** For a (mirrored-to-right) hand, normal.z < 0 means the palm faces the camera. */
function facingTitle(normal: Point3) {
  if (normal.z < -0.55) return { target: "к камере", current: "повёрнута к камере" };
  if (normal.z > 0.55)
    return { target: "тыльной стороной к камере", current: "повёрнута тыльной стороной" };
  return { target: "ребром к камере", current: "повёрнута ребром" };
}

function orientationIssue(
  input: readonly number[],
  reference: readonly number[],
): Pick<Issue, "code" | "message"> {
  const directionInput = readVector(input, "orientation.direction");
  const directionReference = readVector(reference, "orientation.direction");
  const normalInput = readVector(input, "orientation.normal");
  const normalReference = readVector(reference, "orientation.normal");
  const directionTarget = directionTitle(directionReference);
  const directionError =
    directionTitle(directionInput) !== directionTarget ? 1 : 0;
  const facingTarget = facingTitle(normalReference);
  const facingCurrent = facingTitle(normalInput);
  if (facingTarget.target !== facingCurrent.target && !directionError)
    return {
      code: "PALM_ORIENTATION",
      message: hints.turnPalm(facingTarget.target, facingCurrent.current),
    };
  if (directionError)
    return { code: "PALM_ORIENTATION", message: hints.pointFingers(directionTarget) };
  return {
    code: "PALM_ORIENTATION",
    message: hints.turnPalm(facingTarget.target, "повёрнута немного иначе"),
  };
}

/**
 * Compares a hand-shape with the closest sample of the target gesture and returns
 * up to two concrete corrections, the most certain first.
 */
export function analyzeGestureErrors(
  input: readonly number[],
  model: StaticGestureModel,
): Analysis {
  const reference = nearestSample(input, model);
  const issues: Issue[] = [];
  const correct: number[] = [];
  for (const group of FEATURE_GROUPS) {
    const ratio =
      groupDeviation(input, reference, group) / model.groupThreshold[group];
    if (ratio <= 1) {
      if (isFinger(group)) correct.push(...FINGER_LANDMARKS[group]);
      continue;
    }
    if (group === "thumb")
      issues.push({ group, ratio, landmarks: [...FINGER_LANDMARKS.thumb], ...thumbIssue(input, reference) });
    else if (isFinger(group))
      issues.push({ group, ratio, landmarks: [...FINGER_LANDMARKS[group]], ...fingerIssue(group, input, reference) });
    else if (group === "spread")
      issues.push({ group, ratio, ...spreadIssue(input, reference) });
    else
      issues.push({ group, ratio, landmarks: [...PALM_LANDMARKS], ...orientationIssue(input, reference) });
  }
  // A folded finger also changes the spread/contact features of its neighbours:
  // report the finger itself, not a confusing "spread" hint.
  const fingersWithIssues = new Set(
    issues.flatMap((issue) => (isFinger(issue.group) ? issue.landmarks : [])),
  );
  const relevant = issues.filter(
    (issue) =>
      issue.group !== "spread" ||
      !issue.landmarks.some((index) => fingersWithIssues.has(index)),
  );
  // Orientation errors change every other feature, so fix them first; then the
  // shape of individual fingers; spread is the finest detail.
  function priority(issue: Issue) {
    if (issue.group === "orientation") return issue.ratio * (issue.ratio > 1.5 ? 3 : 1);
    if (issue.group === "spread") return issue.ratio * 0.8;
    return issue.ratio * 1.2;
  }
  relevant.sort((a, b) => priority(b) - priority(a));
  const top = relevant.slice(0, 2);
  const incorrect = [...new Set(top.flatMap((issue) => issue.landmarks))];
  return {
    issues: top,
    errorCodes: [...new Set(top.map((issue) => issue.code))],
    message: top[0]?.message,
    incorrectLandmarks: incorrect,
    correctLandmarks: correct.filter((index) => !incorrect.includes(index)),
  };
}
