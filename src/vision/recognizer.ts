import type { GestureErrorCode, RecognitionResult, RecognitionStatus } from "../types/vision.ts";
import {
  analyzeDynamic,
  distanceToDynamicModel,
  handLocation,
  motionVector,
  MotionSegmenter,
  type DynamicGestureModel,
} from "./dynamicMatcher.ts";
import { analyzeGestureErrors } from "./errorAnalyzer.ts";
import { extractHandFeatures } from "./features.ts";
import { hints } from "./hints.ts";
import {
  compareStaticGesture,
  similarity,
  type StaticGestureModel,
} from "./staticMatcher.ts";
import { HintSelector, HoldStabilizer } from "./stabilizer.ts";
import type { BodyReference, Hand, HandObservation } from "./types.ts";

export interface VisionFrame {
  t: number;
  hands: readonly HandObservation[];
  body?: BodyReference;
  /** Average frame brightness 0–255, measured occasionally. */
  brightness?: number;
}

export interface RecognizerOptions {
  exercise?: "hand-visibility";
  targetId: string;
  targetLabel: string;
  targetKind: "static" | "dynamic";
  labels: Readonly<Record<string, string>>;
  staticModels: ReadonlyMap<string, StaticGestureModel>;
  dynamicModels: ReadonlyMap<string, DynamicGestureModel>;
  dominantHand: Hand;
  /** 1 = default strictness; > 1 is more forgiving. */
  tolerance?: number;
  /** Gesture-specific hint overrides from the database. */
  customHints?: Partial<Record<GestureErrorCode, string>>;
}

interface Hint {
  code: GestureErrorCode;
  message: string;
  landmarks: number[];
  status: RecognitionStatus;
}

const ALL_LANDMARKS = Array.from({ length: 21 }, (_, index) => index);

export function hasModel(options: Pick<RecognizerOptions, "targetId" | "targetKind" | "staticModels" | "dynamicModels">) {
  return options.targetKind === "static"
    ? options.staticModels.has(options.targetId)
    : options.dynamicModels.has(options.targetId);
}

/** Picks the signing hand: the dominant one if visible, otherwise the biggest. */
export function pickHand(hands: readonly HandObservation[], dominant: Hand) {
  const size = (hand: HandObservation) => {
    const wrist = hand.image[0];
    const middle = hand.image[9];
    return wrist && middle ? Math.hypot(middle.x - wrist.x, middle.y - wrist.y) : 0;
  };
  return (
    hands.find((hand) => hand.hand === dominant) ??
    [...hands].sort((a, b) => size(b) - size(a))[0]
  );
}

function environmentProblem(hand: HandObservation | undefined, brightness?: number) {
  if (!hand) {
    if (brightness !== undefined && brightness < 45)
      return { code: "LOW_LIGHT" as const, message: hints.lowLight() };
    return undefined;
  }
  const cut = hand.image.some(
    (point) => point.x < 0.01 || point.x > 0.99 || point.y < 0.01 || point.y > 0.99,
  );
  if (cut) return { code: "HAND_OUT_OF_FRAME" as const, message: hints.handCut() };
  const wrist = hand.image[0];
  const middle = hand.image[9];
  if (wrist && middle && Math.hypot(middle.x - wrist.x, middle.y - wrist.y) < 0.05)
    return { code: "HAND_OUT_OF_FRAME" as const, message: hints.handTooFar() };
  return undefined;
}

// Один экземпляр хранит удержание и подсказки только для текущего шага урока.
export function createGestureRecognizer(options: RecognizerOptions) {
  const stabilizer = new HoldStabilizer();
  const hintSelector = new HintSelector<Hint>();
  const segmenter = new MotionSegmenter();
  let succeeded: RecognitionResult | undefined;
  let verdict: { result: RecognitionResult; until: number } | undefined;
  let noHandSince = 0;

  function hasReference() {
    return options.exercise === "hand-visibility" || hasModel(options);
  }

  function reset() {
    stabilizer.reset();
    hintSelector.reset();
    segmenter.reset();
    succeeded = undefined;
    verdict = undefined;
    noHandSince = 0;
  }

  function makeResult(partial: Partial<RecognitionResult> & { status: RecognitionStatus }): RecognitionResult {
    return {
      targetGesture: options.targetLabel,
      confidence: 0,
      holdProgress: 0,
      ...partial,
    };
  }

  function hintMessage(code: GestureErrorCode, fallback: string) {
    return options.customHints?.[code] ?? fallback;
  }

  function recognizeFrame(frame: VisionFrame): RecognitionResult {
    if (succeeded) return succeeded;
    const hand = pickHand(frame.hands, options.dominantHand);
    const problem = environmentProblem(hand, frame.brightness);
    if (!hand) {
      noHandSince ||= frame.t;
      if (hasReference() && options.targetKind === "dynamic" && !problem) {
        const completed = recognizeMovement(undefined, frame);
        if (completed.status === "success" || completed.status === "almost" || completed.status === "incorrect") return completed;
      }
      stabilizer.push(false, frame.t);
      if (problem)
        return makeResult({ status: "environment-error", message: problem.message, errorCodes: [problem.code] });
      return makeResult({ status: "idle", message: frame.t - noHandSince > 800 ? hints.handNotVisible() : undefined });
    }
    noHandSince = 0;
    if (problem) {
      stabilizer.push(false, frame.t);
      return makeResult({ status: "environment-error", message: problem.message, errorCodes: [problem.code] });
    }
    if (options.exercise === "hand-visibility") {
      const hold = stabilizer.push(true, frame.t);
      const result = makeResult({
        status: hold.success ? "success" : "searching",
        holdProgress: hold.progress,
        correctLandmarks: ALL_LANDMARKS,
        message: hold.success ? "Рука обнаружена и удержана в кадре. Тест завершён." : "Вижу руку. Удерживайте её полностью в кадре.",
      });
      if (hold.success) succeeded = result;
      return result;
    }
    if (!hasReference()) return makeResult({ status: "idle", message: hints.noSamples() });
    return options.targetKind === "static"
      ? recognizeStaticHand(hand, frame.t)
      : recognizeMovement(hand, frame);
  }

  function recognizeStaticHand(hand: HandObservation, t: number): RecognitionResult {
    const { staticModels, targetId, labels } = options;
    const tolerance = options.tolerance ?? 1;
    const model = staticModels.get(targetId);
    if (!model) return makeResult({ status: "idle", message: hints.noSamples() });
    const features = extractHandFeatures(hand.world, hand.hand);
    const decision = compareStaticGesture(features, targetId, staticModels, tolerance);
    if (!decision) return makeResult({ status: "idle", message: hints.noSamples() });
    const { distance, accept, rival, matched } = decision;
    const confidence = similarity(distance, accept);
    const hold = stabilizer.push(matched, t);
    if (hold.success) {
      succeeded = makeResult({
        status: "success",
        confidence,
        holdProgress: 1,
        predictedGesture: options.targetLabel,
        correctLandmarks: ALL_LANDMARKS,
      });
      return succeeded;
    }
    if (matched) {
      hintSelector.reset();
      return makeResult({
        status: "searching",
        confidence,
        holdProgress: hold.progress,
        message: hints.holdStill(),
        predictedGesture: options.targetLabel,
        correctLandmarks: ALL_LANDMARKS,
      });
    }
    const analysis = analyzeGestureErrors(features, model);
    const wrong = rival && rival.distance < distance * 0.75 ? rival : undefined;
    let candidate: Hint | undefined;
    if (wrong) {
      candidate = {
        code: "WRONG_GESTURE",
        status: "incorrect",
        message: hints.similarTo(labels[wrong.gestureId] ?? "другой жест", analysis.message),
        landmarks: analysis.incorrectLandmarks,
      };
    } else if (analysis.issues[0]) {
      const issue = analysis.issues[0];
      candidate = {
        code: issue.code,
        status: distance <= accept * 2.2 ? "almost" : "incorrect",
        message: hintMessage(issue.code, issue.message),
        landmarks: analysis.incorrectLandmarks,
      };
    }
    const hint = hintSelector.push(candidate, t);
    if (!hint)
      return makeResult({ status: "searching", confidence, message: hints.checking() });
    return makeResult({
      status: hint.status,
      confidence,
      message: hint.message,
      errorCodes: [hint.code],
      incorrectLandmarks: hint.landmarks,
      correctLandmarks: analysis.correctLandmarks.filter((index) => !hint.landmarks.includes(index)),
      predictedGesture: wrong ? labels[wrong.gestureId] : undefined,
    });
  }

  function recognizeMovement(hand: HandObservation | undefined, frame: VisionFrame): RecognitionResult {
    const { dynamicModels, targetId, labels } = options;
    const tolerance = options.tolerance ?? 1;
    const model = dynamicModels.get(targetId);
    if (!model) return makeResult({ status: "idle", message: hints.noSamples() });
    const point = hand ? { vector: motionVector(extractHandFeatures(hand.world, hand.hand), handLocation(hand.image, hand.hand, frame.body)), t: frame.t } : undefined;
    const recording = segmenter.push(point, frame.t);
    if (!recording) {
      if (segmenter.recording) {
        verdict = undefined;
        return makeResult({
          status: "searching",
          holdProgress: segmenter.progress(frame.t),
          message: hints.recording(),
        });
      }
      if (verdict && frame.t < verdict.until) return verdict.result;
      return makeResult({ status: "searching", message: hints.startMoving() });
    }
    const { distance } = distanceToDynamicModel(recording.sequence, model);
    const accept = model.acceptDistance * tolerance;
    const confidence = similarity(distance, accept);
    if (distance <= accept) {
      succeeded = makeResult({
        status: "success",
        confidence,
        holdProgress: 1,
        predictedGesture: options.targetLabel,
        correctLandmarks: ALL_LANDMARKS,
      });
      return succeeded;
    }
    const analysis = analyzeDynamic(recording.sequence, recording.durationMs, model);
    let best: { id: string; distance: number } | undefined;
    for (const [id, other] of dynamicModels) {
      if (id === targetId) continue;
      const value = distanceToDynamicModel(recording.sequence, other).distance;
      if (value <= other.acceptDistance * tolerance && (!best || value < best.distance))
        best = { id, distance: value };
    }
    const wrong = best && best.distance < distance * 0.75;
    const code: GestureErrorCode = wrong ? "WRONG_GESTURE" : (analysis.errorCodes[0] ?? "AMPLITUDE");
    const message = wrong
      ? hints.similarTo(labels[best?.id ?? ""] ?? "другой жест", analysis.message)
      : hintMessage(code, analysis.message ?? "Повторите движение, как на эталоне.");
    const result = makeResult({
      status: wrong || distance > accept * 2 ? "incorrect" : "almost",
      confidence,
      message,
      errorCodes: [code],
      incorrectLandmarks: analysis.incorrectLandmarks,
    });
    verdict = { result, until: frame.t + 2200 };
    return result;
  }

  return { recognizeFrame, reset, get available() { return hasReference(); } };
}
