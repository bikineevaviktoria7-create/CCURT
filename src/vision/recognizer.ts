import { analyzeGestureErrors } from "./errorAnalyzer.ts";
import { extractHandFeatures } from "./features.ts";
import { hints } from "./hints.ts";
import {
  compareStaticGesture,
  similarity,
  type StaticGestureModel,
} from "./staticMatcher.ts";
import { HintSelector, HoldStabilizer } from "./stabilizer.ts";
import type { Hand, HandObservation } from "./types.ts";
import type { GestureErrorCode, RecognitionResult, RecognitionStatus } from "../types/vision.ts";

export interface VisionFrame {
  t: number;
  hands: readonly HandObservation[];
  /** Средняя яркость кадра 0–255, измеряется время от времени. */
  brightness?: number;
}

/** Покадровый распознаватель для одного шага урока. */
export interface GestureRecognizerApi {
  recognizeFrame(frame: VisionFrame): RecognitionResult;
  reset(): void;
  readonly available: boolean;
}

export interface RecognizerOptions {
  exercise?: "hand-visibility";
  targetId: string;
  targetLabel: string;
  labels: Readonly<Record<string, string>>;
  staticModels: ReadonlyMap<string, StaticGestureModel>;
  dominantHand: Hand;
  /** 1 — обычная строгость; больше 1 — мягче. */
  tolerance?: number;
  diagnostics?: boolean;
  /** Подсказки для конкретного жеста из базы данных, заменяют стандартные. */
  customHints?: Partial<Record<GestureErrorCode, string>>;
}

interface Hint {
  code: GestureErrorCode;
  message: string;
  landmarks: number[];
  status: RecognitionStatus;
}

const ALL_LANDMARKS = Array.from({ length: 21 }, (_, index) => index);

/** Есть ли записанные эталоны для целевого жеста. */
export function hasModel(options: Pick<RecognizerOptions, "targetId" | "staticModels">) {
  return options.staticModels.has(options.targetId);
}

/** Выбирает руку, которой показывают жест: ведущую, если она видна, иначе самую крупную. */
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

function environmentIssue(hand: HandObservation | undefined, brightness?: number) {
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
export class GestureRecognizer implements GestureRecognizerApi {
  private readonly options: RecognizerOptions;
  private readonly stabilizer: HoldStabilizer;
  private readonly hintSelector: HintSelector<Hint>;
  private succeeded: RecognitionResult | undefined;
  private noHandSince: number;
  private diagnostics: RecognitionResult["diagnostics"];

  constructor(options: RecognizerOptions) {
    this.options = options;
    this.stabilizer = new HoldStabilizer();
    this.hintSelector = new HintSelector<Hint>();
    this.succeeded = undefined;
    this.noHandSince = 0;
  }

  /** Может ли распознаватель оценить цель (есть эталоны или это упражнение на видимость руки). */
  get available() {
    return this.canEvaluate();
  }

  private canEvaluate() {
    return this.options.exercise === "hand-visibility" || hasModel(this.options);
  }

  reset() {
    this.stabilizer.reset();
    this.hintSelector.reset();
    this.diagnostics = undefined;
    this.succeeded = undefined;
    this.noHandSince = 0;
  }

  private makeResult(partial: Partial<RecognitionResult> & { status: RecognitionStatus }): RecognitionResult {
    return {
      targetLabel: this.options.targetLabel,
      confidence: 0,
      holdProgress: 0,
      ...(this.options.diagnostics ? { diagnostics: this.diagnostics } : {}),
      ...partial,
    };
  }

  private hintMessage(code: GestureErrorCode, fallback: string) {
    return this.options.customHints?.[code] ?? fallback;
  }

  recognizeFrame(frame: VisionFrame): RecognitionResult {
    if (this.succeeded) return this.succeeded;
    if (!this.canEvaluate()) return this.makeResult({
      status: "idle", referenceIssue: "missing",
      message: "Для этого жеста пока нет эталона положения руки. Оценка недоступна",
    });
    const hand = pickHand(frame.hands, this.options.dominantHand);
    const issue = environmentIssue(hand, frame.brightness);
    if (!hand) {
      this.noHandSince ||= frame.t;
      this.stabilizer.push(false, frame.t);
      if (issue) {
        return this.makeResult({ status: "environment-error", message: issue.message, errorCodes: [issue.code] });
      }
      return this.makeResult({ status: "idle", message: frame.t - this.noHandSince > 800 ? hints.handNotVisible() : undefined });
    }
    this.noHandSince = 0;
    if (issue) {
      this.stabilizer.push(false, frame.t);
      return this.makeResult({ status: "environment-error", message: issue.message, errorCodes: [issue.code] });
    }
    if (this.options.exercise === "hand-visibility") {
      const hold = this.stabilizer.push(true, frame.t);
      const result = this.makeResult({
        status: hold.success ? "success" : "searching",
        holdProgress: hold.progress,
        correctLandmarks: ALL_LANDMARKS,
        message: hold.success ? "Рука обнаружена и удержана в кадре. Тест завершён." : "Вижу руку. Удерживайте её полностью в кадре.",
      });
      if (hold.success) this.succeeded = result;
      return result;
    }
    return this.recognizeStaticHand(hand, frame.t);
  }

  private recognizeStaticHand(hand: HandObservation, t: number): RecognitionResult {
    const { staticModels, targetId, labels } = this.options;
    const tolerance = this.options.tolerance ?? 1;
    const model = staticModels.get(targetId);
    if (!model) return this.makeResult({ status: "idle", message: hints.noSamples() });
    const features = extractHandFeatures(hand.world, hand.hand);
    const decision = compareStaticGesture(features, targetId, staticModels, tolerance);
    if (!decision) return this.makeResult({ status: "idle", message: hints.noSamples() });
    const { distance, accept, rival, matched } = decision;
    if (this.options.diagnostics) this.diagnostics = {
      targetId, sampleCount: model.samples.length, distance, threshold: accept,
      nearestGestureId: decision.nearest.gestureId,
      rivalDistance: rival?.distance, matched,
    };
    const confidence = similarity(distance, accept);
    const hold = this.stabilizer.push(matched, t);
    if (hold.success) {
      this.succeeded = this.makeResult({
        status: "success",
        confidence,
        holdProgress: 1,
        predictedLabel: this.options.targetLabel,
        correctLandmarks: ALL_LANDMARKS,
      });
      return this.succeeded;
    }
    if (matched) {
      this.hintSelector.reset();
      return this.makeResult({
        status: "searching",
        confidence,
        holdProgress: hold.progress,
        message: hints.holdStill(),
        predictedLabel: this.options.targetLabel,
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
        message: this.hintMessage(issue.code, issue.message),
        landmarks: analysis.incorrectLandmarks,
      };
    }
    const hint = this.hintSelector.push(candidate, t);
    if (!hint)
      return this.makeResult({ status: "searching", confidence, message: hints.checking() });
    return this.makeResult({
      status: hint.status,
      confidence,
      message: hint.message,
      errorCodes: [hint.code],
      incorrectLandmarks: hint.landmarks,
      correctLandmarks: analysis.correctLandmarks.filter((index) => !hint.landmarks.includes(index)),
      predictedLabel: wrong ? labels[wrong.gestureId] : undefined,
    });
  }
}

/** Создаёт распознаватель для одного шага урока. */
export function createGestureRecognizer(options: RecognizerOptions): GestureRecognizerApi {
  return new GestureRecognizer(options);
}
