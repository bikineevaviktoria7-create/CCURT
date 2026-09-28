import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractHandFeatures,
  FEATURE_COUNT,
  fingerFlexion,
  readVector,
} from "../src/vision/features.ts";
import { resolveHandedness } from "../src/vision/normalize.ts";
import {
  buildStaticModels,
  distanceToModel,
  rankGestures,
} from "../src/vision/staticMatcher.ts";
import { analyzeGestureErrors } from "../src/vision/errorAnalyzer.ts";
import { createGestureRecognizer } from "../src/vision/recognizer.ts";
import {
  buildDynamicModels,
  dtwDistance,
  MotionSegmenter,
  resample,
} from "../src/vision/dynamicMatcher.ts";
import type { GestureSample, HandObservation } from "../src/vision/types.ts";
import {
  FIST,
  makeHand,
  mirror,
  OPEN,
  PINKY_BENT,
  toImage,
  transform,
  V_SIGN,
  type HandPose,
} from "./helpers/syntheticHand.ts";

const samplesFor = (gestureId: string, pose: HandPose, count = 10, seed = 10): GestureSample[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${gestureId}-${index}`,
    gestureId,
    features: extractHandFeatures(makeHand(pose, 0.003, seed + index), "right"),
    featureVersion: 1,
  }));

const library = [
  ...samplesFor("open", OPEN),
  ...samplesFor("fist", FIST, 10, 100),
  ...samplesFor("pinky", PINKY_BENT, 10, 200),
  ...samplesFor("v", V_SIGN, 10, 300),
];
const models = buildStaticModels(library);

test("features ignore hand size and position; left hand matches right", () => {
  const hand = makeHand(V_SIGN);
  const base = extractHandFeatures(hand, "right");
  assert.equal(base.length, FEATURE_COUNT);
  const moved = extractHandFeatures(transform(hand, 2.5, { x: 0.3, y: -0.2, z: 0.1 }), "right");
  base.forEach((value, index) => assert.ok(Math.abs(value - (moved[index] ?? 0)) < 1e-6));
  const left = extractHandFeatures(mirror(hand), "left");
  base.forEach((value, index) => assert.ok(Math.abs(value - (left[index] ?? 0)) < 1e-6));
});

test("flexion and palm orientation are readable from features", () => {
  const open = extractHandFeatures(makeHand(OPEN), "right");
  const fist = extractHandFeatures(makeHand(FIST), "right");
  assert.ok(fingerFlexion(open, "index") < 0.05);
  assert.ok(fingerFlexion(fist, "index") > 0.35);
  assert.ok(readVector(open, "orientation.normal").z < -0.9, "palm faces the camera");
  assert.ok(readVector(open, "orientation.direction").y < -0.9, "fingers point up");
});

test("MediaPipe handedness is swapped for a non-mirrored frame", () => {
  assert.equal(resolveHandedness("Left"), "right");
  assert.equal(resolveHandedness("Right"), "left");
});

test("kNN ranks the right gesture first for new noisy attempts", () => {
  for (const [id, pose] of [
    ["open", OPEN],
    ["fist", FIST],
    ["pinky", PINKY_BENT],
    ["v", V_SIGN],
  ] as const) {
    const attempt = extractHandFeatures(makeHand(pose, 0.003, 999), "right");
    const ranking = rankGestures(attempt, models);
    assert.equal(ranking[0]?.gestureId, id);
    const model = models.get(id)!;
    assert.ok(distanceToModel(attempt, model) <= model.acceptDistance, `${id} within accept distance`);
  }
});

test("error analyzer names the wrong finger and highlights it", () => {
  const attempt = extractHandFeatures(makeHand(PINKY_BENT, 0.002, 7), "right");
  const analysis = analyzeGestureErrors(attempt, models.get("open")!);
  assert.deepEqual(analysis.errorCodes.slice(0, 1), ["FINGER_NOT_STRAIGHT"]);
  assert.match(analysis.message ?? "", /Выпрямите мизинец/);
  assert.deepEqual(analysis.incorrectLandmarks, [17, 18, 19, 20]);
  assert.ok(analysis.correctLandmarks.includes(8), "index finger is correct");

  const reverse = analyzeGestureErrors(extractHandFeatures(makeHand(OPEN, 0.002, 8), "right"), models.get("pinky")!);
  assert.match(reverse.message ?? "", /Согните мизинец/);
});

test("error analyzer notices a rotated palm", () => {
  const rotated = makeHand(OPEN).map((p) => ({ x: p.z, y: p.y, z: -p.x }));
  const analysis = analyzeGestureErrors(extractHandFeatures(rotated, "right"), models.get("open")!);
  assert.equal(analysis.errorCodes[0], "PALM_ORIENTATION");
  assert.match(analysis.message ?? "", /ладонь/);
});

const observation = (pose: HandPose, seed: number): HandObservation => {
  const world = makeHand(pose, 0.003, seed);
  return { world, image: toImage(world), hand: "right", score: 0.95 };
};

test("recognizer: held correct gesture succeeds, wrong one gets a concrete hint", () => {
  const options = {
    targetId: "open",
    targetLabel: "О",
    targetKind: "static" as const,
    labels: { open: "О", fist: "А", pinky: "Б", v: "В" },
    staticModels: models,
    dynamicModels: new Map(),
    dominantHand: "right" as const,
  };
  const good = createGestureRecognizer(options);
  let result = good.recognizeFrame({ t: 0, hands: [] });
  for (let frame = 1; frame <= 40 && result.status !== "success"; frame++)
    result = good.recognizeFrame({ t: frame * 33, hands: [observation(OPEN, 500 + frame)] });
  assert.equal(result.status, "success");
  assert.equal(result.holdProgress, 1);

  const wrong = createGestureRecognizer(options);
  for (let frame = 1; frame <= 30; frame++)
    result = wrong.recognizeFrame({ t: frame * 33, hands: [observation(PINKY_BENT, 700 + frame)] });
  assert.notEqual(result.status, "success");
  assert.ok(result.errorCodes?.length);
  assert.match(result.message ?? "", /мизин/);
  assert.ok(result.incorrectLandmarks?.includes(20));
});

test("recognizer reports a hand cut by the frame edge and missing samples", () => {
  const recognizer = createGestureRecognizer({
    targetId: "open",
    targetLabel: "О",
    targetKind: "static",
    labels: {},
    staticModels: models,
    dynamicModels: new Map(),
    dominantHand: "right",
  });
  const world = makeHand(OPEN);
  const cut = recognizer.recognizeFrame({
    t: 10,
    hands: [{ world, image: toImage(world, { x: 0.5, y: 0.1 }), hand: "right", score: 0.9 }],
  });
  assert.equal(cut.status, "environment-error");
  assert.deepEqual(cut.errorCodes, ["HAND_OUT_OF_FRAME"]);

  const empty = createGestureRecognizer({
    targetId: "unknown",
    targetLabel: "Я",
    targetKind: "static",
    labels: {},
    staticModels: models,
    dynamicModels: new Map(),
    dominantHand: "right",
  });
  assert.equal(empty.available, false);
});

test("DTW tolerates speed differences but separates different movements", () => {
  const wave = (frames: number, amplitude: number) =>
    Array.from({ length: frames }, (_, index) => [
      Math.sin((index / (frames - 1)) * Math.PI * 2) * amplitude,
      0.5,
      0, 0, 0, 0, 0, -1,
    ]);
  const slow = resample(wave(40, 1));
  const fast = resample(wave(15, 1));
  const lift = resample(Array.from({ length: 30 }, (_, index) => [0, 1 - index / 15, 0, 0, 0, 0, 0, -1]));
  assert.ok(dtwDistance(slow, fast) < 0.05);
  assert.ok(dtwDistance(slow, lift) > 0.2);
  const models = buildDynamicModels([
    { id: "a", gestureId: "wave", sequence: wave(30, 1), durationMs: 1200, featureVersion: 1 },
    { id: "b", gestureId: "wave", sequence: wave(26, 1.05), durationMs: 1100, featureVersion: 1 },
  ]);
  assert.ok(models.get("wave")!.acceptDistance > 0);
});

test("motion segmenter cuts a movement out of the stream", () => {
  const segmenter = new MotionSegmenter();
  let recording;
  for (let frame = 0; frame < 120 && !recording; frame++) {
    const t = frame * 33;
    const moving = frame >= 10 && frame < 50;
    const x = moving ? Math.sin((frame - 10) / 6) * 0.8 : frame >= 50 ? Math.sin(40 / 6) * 0.8 : 0;
    recording = segmenter.push({ vector: [x, 0, 0, 0, 0, 0, 0, -1], t }, t);
  }
  assert.ok(recording, "a recording is produced");
  assert.ok(recording.durationMs > 600 && recording.durationMs <= MotionSegmenter.MAX_MS);
});

test("a similar gesture that is clearly closer is never counted as the target", () => {
  const recognizer = createGestureRecognizer({
    targetId: "open",
    targetLabel: "О",
    targetKind: "static",
    labels: { open: "О", pinky: "Б" },
    staticModels: models,
    dynamicModels: new Map(),
    dominantHand: "right",
    tolerance: 3, // so forgiving that "open" alone would accept the attempt
  });
  let result;
  for (let frame = 1; frame <= 40; frame++)
    result = recognizer.recognizeFrame({ t: frame * 33, hands: [observation(PINKY_BENT, 900 + frame)] });
  assert.notEqual(result?.status, "success");
  assert.equal(result?.errorCodes?.[0], "WRONG_GESTURE");
  assert.match(result?.message ?? "", /похоже на «Б»/);
});
