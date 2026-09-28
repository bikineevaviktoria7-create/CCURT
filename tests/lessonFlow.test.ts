import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialSession,
  lessonSessionReducer,
} from "../src/lib/lessonSession.ts";
import {
  calculateLessonResult,
  emptyProgress,
  lessonStatus,
  progressService,
} from "../src/services/progressService.ts";
import { mockLessons } from "../src/data/mockLessons.ts";
import type { GestureAttempt } from "../src/types/progress.ts";

const correct: GestureAttempt = {
  gestureId: "letter-1",
  success: true,
  skipped: false,
  confidence: 0.92,
  errorCodes: [],
  durationMs: 2000,
};

test("all theory is required before practice; practice never returns to theory", () => {
  let state = initialSession(1000);
  assert.equal(
    lessonSessionReducer(state, { type: "START_PRACTICE", now: 2000 }),
    state,
  );
  for (let index = 0; index < 3; index++) {
    assert.equal(state.phase, "learn");
    assert.equal(state.currentGestureIndex, index);
    state = lessonSessionReducer(state, { type: "NEXT_THEORY", total: 3 });
  }
  assert.equal(state.phase, "ready");
  state = lessonSessionReducer(state, { type: "START_PRACTICE", now: 2000 });
  for (let index = 0; index < 3; index++) {
    assert.equal(state.phase, "practice");
    assert.equal(state.currentGestureIndex, index);
    state = lessonSessionReducer(state, {
      type: "ACCEPT",
      attempt: { ...correct, gestureId: `letter-${index + 1}` },
    });
    assert.equal(state.phase, "transition");
    assert.equal(
      lessonSessionReducer(state, { type: "ACCEPT", attempt: correct }),
      state,
    );
    state = lessonSessionReducer(state, {
      type: "ADVANCE",
      total: 3,
      now: 3000 + index * 2000,
    });
  }
  assert.equal(state.phase, "completed");
  assert.equal(state.attempts.length, 3);
});

test("scoring penalizes corrections and skips deterministically", () => {
  const perfect = calculateLessonResult("1", [correct], 0, "perfect");
  assert.equal(perfect.score, 1000);
  assert.equal(perfect.stars, 3);
  const corrected = calculateLessonResult(
    "1",
    [{ ...correct, errorCodes: ["FINGER_NOT_BENT"] }],
    0,
    "corrected",
  );
  assert.equal(corrected.accuracy, 92);
  const skipped = calculateLessonResult(
    "1",
    [{ ...correct, success: false, skipped: true }],
    0,
    "skipped",
  );
  assert.equal(skipped.score, 0);
  assert.equal(skipped.stars, 1);
});

test("completion persists once and unlocks only the next lesson", () => {
  const result = calculateLessonResult("1", [correct], 0, "unique-session");
  const initial = emptyProgress();
  const first = mockLessons[0]!;
  const second = mockLessons[1]!;
  assert.equal(lessonStatus(first, mockLessons, initial), "current");
  assert.equal(lessonStatus(second, mockLessons, initial), "locked");
  progressService.completeLesson("test-user", result);
  const persisted = progressService.completeLesson("test-user", result);
  assert.equal(persisted.sessions.length, 1);
  assert.equal(lessonStatus(first, mockLessons, persisted), "completed");
  assert.equal(lessonStatus(second, mockLessons, persisted), "current");
  assert.equal(lessonStatus(mockLessons[2]!, mockLessons, persisted), "locked");
});
