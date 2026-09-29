import assert from "node:assert/strict";
import { test } from "node:test";
import { createGestureRecognizer, type RecognizerOptions } from "../../src/vision/recognizer.ts";
import { makeHand, toImage } from "./helpers/syntheticHand.ts";
import type { HandObservation } from "../../src/vision/types.ts";
const options: RecognizerOptions = { targetId: "preview-hand", targetLabel: "Рука в кадре", targetKind: "static", exercise: "hand-visibility", labels: {}, staticModels: new Map(), dynamicModels: new Map(), dominantHand: "right" };
const world = makeHand();
const hand: HandObservation = { world, image: toImage(world), hand: "right", score: 0.95 };

test("preview requires observed landmarks; time alone never succeeds", () => {
  const recognizer = createGestureRecognizer(options);
  for (let t = 0; t < 10000; t += 40) assert.equal(recognizer.recognizeFrame({ t, hands: [] }).status, "idle");
  assert.equal(recognizer.recognizeFrame({ t: 10001, hands: [], brightness: 10 }).status, "environment-error");
  assert.equal(recognizer.recognizeFrame({ t: 10002, hands: [{ ...hand, image: toImage(world, { x: 1, y: 0.6 }) }] }).status, "environment-error");
  let result = recognizer.recognizeFrame({ t: 10040, hands: [hand] });
  assert.notEqual(result.status, "success");
  for (let t = 10080; t <= 11500; t += 40) result = recognizer.recognizeFrame({ t, hands: [hand] });
  assert.equal(result.status, "success");
  assert.equal(result.holdProgress, 1);
  assert.equal(result.correctLandmarks?.length, 21);
  recognizer.reset();
  result = recognizer.recognizeFrame({ t: 12000, hands: [hand] });
  assert.equal(result.status, "searching");
  assert.equal(result.holdProgress, 0);
});
test("ordinary gestures without reference samples never pass with visible hands", () => {
  const recognizer = createGestureRecognizer({ ...options, exercise: undefined, targetId: "letter-1" });
  for (let t = 0; t < 10000; t += 40) assert.equal(recognizer.recognizeFrame({ t, hands: [hand] }).status, "idle");
});

import { buildDynamicModels, handLocation, motionVector } from "../../src/vision/dynamicMatcher.ts";
import { extractHandFeatures } from "../../src/vision/features.ts";

test("dynamic recording completed by losing the hand is evaluated instead of discarded", () => {
  const hands = Array.from({ length: 30 }, (_, i) => ({ ...hand, image: toImage(world, { x: .5 + .15 * Math.sin(i * Math.PI / 8), y: .6 }) }));
  const sequence = hands.map(h => motionVector(extractHandFeatures(h.world, h.hand), handLocation(h.image, h.hand)));
  const dynamicModels = buildDynamicModels([{ id: "synthetic-motion", gestureId: "motion", sequence, durationMs: 1500, featureVersion: 1 }]);
  const recognizer = createGestureRecognizer({ ...options, exercise: undefined, targetId: "motion", targetKind: "dynamic", dynamicModels });
  hands.forEach((h, index) => recognizer.recognizeFrame({ t: 100 + index * 40, hands: [h] }));
  assert.notEqual(recognizer.recognizeFrame({ t: 1300, hands: [] }).status, "success");
  const result = recognizer.recognizeFrame({ t: 1700, hands: [] });
  assert.equal(result.status, "success");
});
