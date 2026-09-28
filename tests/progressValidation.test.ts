import { accountId, setMockAccount } from "./helpers/mockAccount.ts";
beforeEach(setMockAccount);
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage } from "../src/lib/storage.ts";
import { calculateLessonResult, emptyProgress, isLessonResult, lessonStatus, progressService } from "../src/services/progressService.ts";
import { lessons } from "../src/data/lessons.ts";
import type { GestureAttempt } from "../src/types/progress.ts";

const attempt: GestureAttempt = { gestureId: "letter-1", success: true, skipped: false, errorCodes: [], durationMs: 1200 };
const result = (id: string) => calculateLessonResult("1", [{ ...attempt }], Date.now() - 1200, id);

test("demo and mixed sessions remain viewable without unlocking or contributing statistics", () => {
  const demo = calculateLessonResult("1", [{ ...attempt, mode: "real" }, { ...attempt, mode: "demo" }], Date.now() - 1200, "demo-session");
  assert.equal(demo.mode, "demo");
  // Even an incorrect session-level flag cannot hide a mock attempt.
  demo.mode = "real";
  assert.deepEqual(progressService.completeLesson(accountId, demo), emptyProgress());
  assert.deepEqual(progressService.getResult(accountId, demo.sessionId), demo);
  assert.deepEqual(progressService.mergeResults(accountId, [demo]), emptyProgress());
  assert.equal(lessonStatus(lessons[1]!, lessons, progressService.getProgress(accountId)), "available");
  const real = result("real-session");
  const saved = progressService.completeLesson(accountId, real);
  assert.equal(saved.sessions.length, 1);
  assert.equal(saved.lessons["1"]?.bestScore, 1000);
  assert.equal(lessonStatus(lessons[1]!, lessons, saved), "current");
});

test("valid legacy progress without mode survives validation and merging", () => {
  const legacy = result("legacy");
  delete legacy.mode;
  const saved = progressService.completeLesson(accountId, legacy);
  assert.deepEqual(progressService.getProgress(accountId), saved);
  assert.equal(isLessonResult(legacy), true);
  assert.equal(progressService.mergeResults(accountId, [legacy]).sessions.length, 1);
});

test("persisted demo aggregates are removed or rebuilt from legitimate sessions", () => {
  const demo = { ...result("known-demo"), mode: "demo" as const };
  const real = { ...result("legitimate"), score: 800, accuracy: 80, stars: 2 as const };
  storage.write(`progress:${accountId}`, {
    lessons: { "1": { lessonId: "1", completedAt: demo.completedAt, bestScore: 1000, bestAccuracy: 100, stars: 3 } },
    sessions: [demo, real], lastLessonId: "1",
  });
  const repaired = progressService.getProgress(accountId);
  assert.equal(repaired.lessons["1"]?.bestScore, 800);
  assert.equal(repaired.sessions.length, 1);
});

test("invalid persisted fields, nested arrays and prototype values are rejected safely", () => {
  const valid = result("valid");
  const invalid: unknown[] = [
    { ...valid, completedAt: undefined }, { ...valid, completedAt: "invalid" },
    { ...valid, score: Infinity }, { ...valid, accuracy: NaN },
    { ...valid, stars: "3" }, { ...valid, stars: 1.5 }, { ...valid, durationMs: -1 },
    { ...valid, mode: "unknown" }, { ...valid, lessonId: "__proto__" },
    { ...valid, attempts: [null] }, { ...valid, attempts: new Array(1) },
    { ...valid, attempts: [{ ...attempt, gestureId: undefined }] },
    { ...valid, attempts: [{ ...attempt, skipped: undefined }] },
    { ...valid, attempts: [{ ...attempt, confidence: "0.9" }] },
    { ...valid, attempts: [{ ...attempt, confidence: 2 }] },
    ...["__proto__", "constructor", "toString"].map((code) => ({ ...valid, attempts: [{ ...attempt, errorCodes: [code] }] })),
    { ...valid, attempts: [{ ...attempt, errorCodes: new Array(1) }] },
    Object.create(valid),
  ];
  for (const item of invalid) assert.equal(isLessonResult(item), false);
  storage.write(`progress:${accountId}`, {
    lessons: { broken: { stars: "3" } }, sessions: [...invalid, valid], lastLessonId: 42,
  });
  const restored = progressService.getProgress(accountId);
  assert.deepEqual(restored.sessions, [valid]);
  assert.deepEqual(restored.lessons, {});
  assert.equal(restored.lastLessonId, null);
  assert.doesNotThrow(() => progressService.mergeResults(accountId, [result("new-valid")]));
});
