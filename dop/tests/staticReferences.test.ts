import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { lessons } from "../../src/data/lessons.ts";
import { FEATURE_COUNT, FEATURE_VERSION, extractHandFeatures } from "../../src/vision/features.ts";
import { buildStaticModels, buildStaticModel, compareStaticGesture, isStaticSample, withShapeAliases } from "../../src/vision/staticMatcher.ts";
import { findLetterByLabel } from "../../src/data/alphabet.ts";
import { createGestureRecognizer } from "../../src/vision/recognizer.ts";
import type { GestureSample } from "../../src/vision/types.ts";
import { makeHand, OPEN, toImage } from "./helpers/syntheticHand.ts";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";

const bundle = JSON.parse(readFileSync(new URL("../../public/data/samples.json", import.meta.url), "utf8")) as { samples: GestureSample[]; tolerance: number };
const models = buildStaticModels(bundle.samples);
const world = makeHand(OPEN);
const hand = { world, image: toImage(world), hand: "right" as const, score: .95 };
const sample: GestureSample = { id: "pose", gestureId: "word-hello", featureVersion: FEATURE_VERSION, features: extractHandFeatures(world, "right") };

test("only current, finite, full static vectors become models", () => {
  const invalid = [
    { ...sample, featureVersion: 0 }, { ...sample, features: [] },
    { ...sample, features: sample.features!.slice(1) },
    { ...sample, features: [...sample.features!, 0] },
    { ...sample, features: Array(FEATURE_COUNT).fill(NaN) },
    { ...sample, features: Array(FEATURE_COUNT).fill(Infinity) },
    { ...sample, features: undefined, sequence: [[1, 2, 3]] },
  ];
  for (const item of invalid) assert.equal(isStaticSample(item), false);
  assert.equal(buildStaticModels(invalid).size, 0);
  assert.equal(buildStaticModels([...invalid, sample]).get(sample.gestureId)?.samples.length, 1);
});

test("every active gesture uses static matching; missing key poses are explicit", () => {
  const active = new Map(lessons.flatMap(lesson => lesson.gestures.map(gesture => [gesture.id, gesture] as const)));
  const missing: string[] = [];
  for (const gesture of active.values()) {
    assert.equal(gesture.kind, "static");
    const recognizer = createGestureRecognizer({ targetId: gesture.id, targetLabel: gesture.label, staticModels: models, labels: {}, dominantHand: "right" });
    if (models.has(gesture.id)) { assert.equal(recognizer.available, true); continue; }
    missing.push(gesture.label);
    assert.equal(gesture.positionOnly, true);
    for (let t = 0; t < 2000; t += 40) {
      const result = recognizer.recognizeFrame({ t, hands: [hand], brightness: 1 });
      assert.equal(result.referenceIssue, "missing");
      assert.equal(result.status, "idle");
      assert.equal(result.errorCodes, undefined);
      assert.equal(result.holdProgress, 0);
    }
  }
  // Слова практикуются дактилем по буквам; у Ё, Й, Щ своих эталонов нет — их сравнивают по Е, И, Ш.
  assert.deepEqual(missing.sort(), ["Ё", "Й", "Щ"].sort());
  assert.equal(models.size, 30);
});

test("a position-only word uses real static comparison and hold, and resets between steps", () => {
  const recognizer = createGestureRecognizer({ targetId: sample.gestureId, targetLabel: "Привет", staticModels: buildStaticModels([sample]), labels: {}, dominantHand: "right", diagnostics: true });
  let result = recognizer.recognizeFrame({ t: 1, hands: [hand] });
  assert.equal(result.status, "searching");
  for (let t = 40; t < 2000; t += 40) result = recognizer.recognizeFrame({ t, hands: [hand] });
  assert.equal(result.status, "success");
  assert.equal(result.diagnostics?.nearestGestureId, sample.gestureId);
  assert.equal(result.diagnostics?.distance, 0);
  recognizer.reset();
  result = recognizer.recognizeFrame({ t: 2500, hands: [hand] });
  assert.equal(result.holdProgress, 0);
  assert.equal(result.status, "searching");
});

test("final alphabet test uses the same IDs and passes held-out reference checks", () => {
  const final = lessons.find(lesson => lesson.id === "10")!;
  assert.deepEqual(final.gestures.map(gesture => gesture.label), ["Б", "Г", "Л", "О", "Т"]);
  for (const gesture of final.gestures) {
    const model = models.get(gesture.id)!;
    for (const [index, features] of model.samples.entries()) {
      const others = new Map(models);
      others.set(gesture.id, buildStaticModel(gesture.id, model.samples.filter((_, i) => i !== index)));
      assert.equal(compareStaticGesture(features, gesture.id, others, bundle.tolerance)?.matched, true, `${gesture.label}: sample ${index}`);
    }
  }
});

test("invalid or movement-only local records cannot hide valid bundled static references", async () => {
  for (const local of [{ ...sample, featureVersion: 0 }, { ...sample, features: [0] }, { ...sample, features: undefined, sequence: [[0, 0]] }]) {
    const { GestureRepository } = loadBrowserModule<typeof import("../../src/services/gestureRepository.ts")>("src/services/gestureRepository.ts", {
      "../lib/supabase": { supabase: null }, "../lib/localDb": { localDb: {} },
      "../vision/staticMatcher": { isStaticSample },
    }, { fetch: async () => ({ ok: true, headers: { get: () => "application/json" }, json: async () => ({ samples: [sample], gestures: [] }) }) });
    const database = { get: async (key: string) => key === "admin:samples" ? [local] : {} };
    const repository = new GestureRepository(null, database as unknown as ConstructorParameters<typeof GestureRepository>[1]);
    const loaded = await repository.load();
    assert.equal(loaded.samples.length, 1);
    assert.equal(isStaticSample(loaded.samples[0]!), true);
    assert.equal(loaded.samples[0]?.id, sample.id);
  }
});

test("Ё, Й, Щ are compared by the hand shape of Е, И, Ш; own samples take priority", () => {
  const id = (label: string) => findLetterByLabel(label)!.id;
  const pairs = [["Ё", "Е"], ["Й", "И"], ["Щ", "Ш"]].map(([alias, base]) => [id(alias!), id(base!)] as const);
  const aliased = withShapeAliases(models, pairs);
  for (const [aliasId, baseId] of pairs) {
    assert.equal(models.has(aliasId), false);
    const base = aliased.get(baseId)!;
    assert.deepEqual(aliased.get(aliasId)?.samples, base.samples);
    assert.equal(aliased.get(aliasId)?.gestureId, aliasId);
    // Эталон базовой буквы засчитывается и для буквы с движением, и для самой базовой буквы.
    assert.equal(compareStaticGesture(base.samples[0]!, aliasId, aliased, bundle.tolerance)?.matched, true);
    assert.equal(compareStaticGesture(base.samples[0]!, baseId, aliased, bundle.tolerance)?.matched, true);
  }
  const own = buildStaticModel(pairs[0]![0], [sample.features!]);
  assert.equal(withShapeAliases(new Map([...models, [own.gestureId, own]]), pairs).get(own.gestureId), own);
});
