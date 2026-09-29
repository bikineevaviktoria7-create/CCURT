import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { accountId, setMockAccount } from "./helpers/mockAccount.ts";
import { storage } from "../src/lib/storage.ts";
import { canUseAdmin, currentUser, requireAdmin, requirePlatform } from "../src/services/accessService.ts";
import { calculateLessonResult, emptyProgress, progressService } from "../src/services/progressService.ts";
import { previewExercise, previewService } from "../src/services/previewService.ts";
import type { GestureAttempt } from "../src/types/progress.ts";

beforeEach(() => { setMockAccount(); previewService.reset(); });
const attempt: GestureAttempt = { gestureId: previewExercise.id, mode: "real", success: true, skipped: false, errorCodes: [], durationMs: 1500 };

test("guest cannot read or mutate registered progress, regular lessons, or admin data", () => {
  const result = calculateLessonResult("1", [{ ...attempt, gestureId: "letter-1" }], Date.now(), "saved");
  progressService.completeLesson(accountId, result);
  storage.write("user", { id: "guest", name: "Guest", isGuest: true, role: "admin" });
  assert.throws(requirePlatform);
  assert.throws(requireAdmin);
  assert.equal(canUseAdmin(currentUser()), false);
  assert.deepEqual(progressService.getProgress(accountId), emptyProgress());
  assert.equal(progressService.getResult(accountId, "saved"), undefined);
  assert.deepEqual(progressService.completeLesson("guest", result), emptyProgress());
  assert.deepEqual(progressService.mergeResults(accountId, [result]), emptyProgress());
  assert.equal(storage.read("progress:guest"), undefined);
});
test("mock account is never promoted to admin by a stored role", () => {
  storage.write("user", { id: accountId, name: "Руслана", isGuest: false, authProvider: "mock", role: "admin" });
  assert.doesNotThrow(requirePlatform);
  assert.throws(requireAdmin);
  assert.equal(currentUser()?.role, "user");
  storage.write("user", { id: "old-local-account", name: "Other", isGuest: false, role: "admin" });
  assert.equal(currentUser(), null);
});
test("preview accepts only one real hand-visibility attempt and never creates lesson progress", () => {
  storage.write("user", { id: "guest", name: "Guest", isGuest: true });
  assert.equal(previewService.complete({ ...attempt, mode: "demo" }), false);
  assert.equal(previewService.complete({ ...attempt, gestureId: "letter-1" }), false);
  assert.equal(previewService.complete(attempt), true);
  assert.deepEqual(previewService.getResult(), attempt);
  assert.equal(previewService.complete(attempt), false);
  assert.equal(storage.read("progress:guest"), undefined);
  setMockAccount();
  assert.equal(previewService.getResult(), undefined);
});

test("preview result is kept only in memory and is gone after a reload", () => {
  storage.write("user", { id: "guest", name: "Guest", isGuest: true });
  assert.equal(previewService.complete(attempt), true);
  assert.equal(storage.read("preview:completed"), undefined, "nothing is written to localStorage");
  previewService.reset(); // what a page reload does to the in-memory state
  assert.equal(previewService.getResult(), undefined);
  assert.equal(previewService.complete(attempt), true, "the preview can be passed again");
});
