import assert from "node:assert/strict";
import { test } from "node:test";
import * as validation from "../src/services/gestureValidation.ts";
import * as features from "../src/vision/features.ts";
import { MOTION_FEATURE_COUNT } from "../src/vision/dynamicMatcher.ts";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";
import type { GestureBundle } from "../src/services/gestureRepository.ts";

const bundle = (): GestureBundle => ({
  version: validation.GESTURE_BUNDLE_VERSION, exportedAt: null, gestures: [], samples: [
    { id: "static", gestureId: "letter-1", featureVersion: features.FEATURE_VERSION,
      features: Array(features.FEATURE_COUNT).fill(0), handedness: "right" },
    { id: "dynamic", gestureId: "word-hello", featureVersion: features.FEATURE_VERSION,
      sequence: [Array(MOTION_FEATURE_COUNT).fill(0), Array(MOTION_FEATURE_COUNT).fill(0.1)], durationMs: 1200 },
  ],
});

test("current static and variable-length dynamic samples pass import validation", () => {
  assert.doesNotThrow(() => validation.validateGestureBundle(bundle()));
});

test("incompatible versions and malformed numeric structures are rejected", () => {
  const valid = bundle();
  const staticSample = valid.samples[0]!;
  const dynamicSample = valid.samples[1]!;
  const invalid = [
    null, { ...valid, version: 99 }, { ...valid, gestures: null }, { ...valid, tolerance: NaN },
    ...[
      { ...staticSample, featureVersion: undefined }, { ...staticSample, featureVersion: features.FEATURE_VERSION + 1 },
      { ...staticSample, id: 3 }, { ...staticSample, gestureId: "" }, { ...staticSample, handedness: "up" },
      { ...staticSample, landmarks: { world: [{ x: Infinity, y: 0, z: 0 }] } },
      { ...staticSample, features: [1, 2] }, { ...staticSample, features: new Array(features.FEATURE_COUNT) },
      ...[NaN, Infinity, -Infinity, "1", null].map((number) => ({ ...staticSample, features: Array(features.FEATURE_COUNT).fill(number) })),
      { ...dynamicSample, durationMs: undefined }, { ...dynamicSample, durationMs: -1 },
      { ...dynamicSample, sequence: [] }, { ...dynamicSample, sequence: [null] },
      { ...dynamicSample, sequence: [[1, 2]] },
      { ...dynamicSample, sequence: [Array(MOTION_FEATURE_COUNT).fill(Infinity)] },
    ].map((sample) => ({ ...valid, samples: [sample] })),
  ];
  for (const item of invalid) assert.throws(() => validation.validateGestureBundle(item));
});

test("an invalid later sample fails before the repository writes anything", async () => {
  let writes = 0;
  const { gestureRepository } = loadBrowserModule<typeof import("../src/services/gestureRepository.ts")>("src/services/gestureRepository.ts", {
    "./accessService": { requireAdmin: () => {} },
    "../lib/supabase": { supabase: null },
    "../lib/localDb": { localDb: { get: async () => [], set: async () => { writes += 1; } } },
    "../vision/features": features,
    "./gestureValidation": validation,
  }, { crypto });
  const invalid = bundle();
  invalid.samples[1]!.sequence![1]![0] = Infinity;
  await assert.rejects(gestureRepository.importBundle("local", invalid), /Эталон 2/);
  assert.equal(writes, 0);
  assert.equal(await gestureRepository.importBundle("local", bundle()), 2);
  assert.equal(writes, 1);
});
