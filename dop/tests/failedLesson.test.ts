import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { accountId, setMockAccount } from "./helpers/mockAccount.ts";
import * as storageModule from "../../src/lib/storage.ts";
import * as progressModule from "../../src/services/progressService.ts";
import { lessons } from "../../src/data/lessons.ts";
import { loadSyncService } from "./helpers/loadSyncService.ts";
import type { GestureAttempt } from "../../src/types/progress.ts";

beforeEach(setMockAccount);

const { calculateLessonResult, emptyProgress, isPassedResult, lessonStatus, progressService, streakDays } = progressModule;
const correct: GestureAttempt = { gestureId: "letter-1", mode: "real", success: true, skipped: false, errorCodes: [], durationMs: 1200 };
const missed: GestureAttempt = { ...correct, success: false };
const skipped: GestureAttempt = { ...correct, success: false, skipped: true };
/** `hits` correct attempts followed by `misses` failed ones. */
const attempts = (hits: number, misses: number, miss = missed) => [
  ...Array.from({ length: hits }, () => ({ ...correct })),
  ...Array.from({ length: misses }, () => ({ ...miss })),
];

test("0% accuracy gives 0 stars and the lesson is not saved to progress", () => {
  const failed = calculateLessonResult("1", attempts(0, 3), Date.now() - 1200, "zero");
  assert.equal(failed.accuracy, 0);
  assert.equal(failed.stars, 0);
  assert.equal(isPassedResult(failed), false);
  assert.deepEqual(progressService.completeLesson(accountId, failed), emptyProgress());
  assert.deepEqual(progressService.getProgress(accountId), emptyProgress());
  assert.equal(storageModule.storage.read(`progress:${accountId}`), undefined);
  // The result stays viewable on the results page.
  assert.deepEqual(progressService.getResult(accountId, "zero"), failed);
  assert.deepEqual(progressService.mergeResults(accountId, [failed]), emptyProgress());
});

test("star thresholds: 39% gives 0 stars, 40% gives 1 star", () => {
  const below = calculateLessonResult("1", attempts(7, 11), 0, "39");
  assert.equal(below.accuracy, 39);
  assert.equal(below.stars, 0);
  const edge = calculateLessonResult("1", attempts(2, 3), 0, "40");
  assert.equal(edge.accuracy, 40);
  assert.equal(edge.stars, 1);
  const two = calculateLessonResult("1", attempts(7, 3), 0, "70");
  assert.equal(two.accuracy, 70);
  assert.equal(two.stars, 2);
  const three = calculateLessonResult("1", attempts(9, 1), 0, "90");
  assert.equal(three.accuracy, 90);
  assert.equal(three.stars, 3);
});

test("skipping every gesture fails the lesson and keeps it out of progress", () => {
  const allSkipped = calculateLessonResult("1", attempts(0, 3, skipped), 0, "all-skipped");
  assert.equal(allSkipped.score, 0);
  assert.equal(allSkipped.stars, 0);
  const progress = progressService.completeLesson(accountId, allSkipped);
  assert.equal(progress.lessons["1"], undefined);
  assert.equal(progress.sessions.length, 0);
});

test("next lesson stays locked until the current one is passed", () => {
  const first = lessons[0]!;
  const second = lessons[1]!;
  const failed = progressService.completeLesson(accountId, calculateLessonResult(first.id, attempts(0, 3), 0, "fail"));
  assert.equal(lessonStatus(first, lessons, failed), "current");
  assert.equal(lessonStatus(second, lessons, failed), "locked");
  const passed = progressService.completeLesson(accountId, calculateLessonResult(first.id, attempts(2, 3), 0, "pass"));
  assert.equal(lessonStatus(first, lessons, passed), "completed");
  assert.equal(lessonStatus(second, lessons, passed), "current");
  assert.equal(lessonStatus(lessons[2]!, lessons, passed), "locked");
});

test("a failed result does not extend the day streak", () => {
  const failed = calculateLessonResult("1", attempts(0, 3), 0, "streak-fail");
  assert.equal(streakDays([failed]), 0);
  const passed = calculateLessonResult("1", attempts(3, 0), 0, "streak-pass");
  assert.equal(streakDays([failed, passed]), 1);
});

test("a failed result never enters the sync queue", async () => {
  const sent: string[] = [];
  const sync = loadSyncService(async ({ id }) => { sent.push(id); return { error: null }; });
  const failed = calculateLessonResult("1", attempts(0, 3), Date.now() - 1200, "sync-fail");
  sync.push("user", failed);
  assert.deepEqual(storageModule.storage.read("pending-sync"), []);
  storageModule.storage.write("pending-sync", [{ userId: "user", result: failed }]);
  await sync.flush();
  assert.deepEqual(sent, []);
});
