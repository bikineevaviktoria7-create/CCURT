import { accountId, setMockAccount } from "./helpers/mockAccount.ts";
beforeEach(setMockAccount);
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  initialSession,
  lessonSessionReducer,
} from "../src/hooks/useLessonSession.ts";
import {
  calculateLessonResult,
  emptyProgress,
  lessonStatus,
  progressService,
} from "../src/services/progressService.ts";
import { lessons as mockLessons } from "../src/data/lessons.ts";
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
    lessonSessionReducer(state, { type: "START_PRACTICE" }),
    state,
  );
  for (let index = 0; index < 3; index++) {
    assert.equal(state.phase, "learn");
    assert.equal(state.currentGestureIndex, index);
    state = lessonSessionReducer(state, { type: "NEXT_THEORY", total: 3 });
  }
  assert.equal(state.phase, "ready");
  state = lessonSessionReducer(state, { type: "START_PRACTICE" });
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

test("completion persists once and keeps all other lessons available", () => {
  const result = calculateLessonResult("1", [correct], 0, "unique-session");
  const initial = emptyProgress();
  const first = mockLessons[0]!;
  const second = mockLessons[1]!;
  assert.equal(lessonStatus(first, mockLessons, initial), "current");
  assert.equal(lessonStatus(second, mockLessons, initial), "available");
  progressService.completeLesson(accountId, result);
  const persisted = progressService.completeLesson(accountId, result);
  assert.equal(persisted.sessions.length, 1);
  assert.equal(lessonStatus(first, mockLessons, persisted), "completed");
  assert.equal(lessonStatus(second, mockLessons, persisted), "current");
  assert.equal(lessonStatus(mockLessons[2]!, mockLessons, persisted), "available");
});

import { buildNameGestures, personalizeLesson } from "../src/lib/nameLesson.ts";
import { findLetterByLabel } from "../src/data/alphabet.ts";

test("own-name lesson spells the name and skips unsupported letters", () => {
  const anna = buildNameGestures("Анна Иванова", findLetterByLabel, null);
  assert.deepEqual(anna.letters.map((letter) => letter.label), ["А", "Н", "Н", "А"]);
  assert.deepEqual(anna.skipped, []);
  const kazakh = buildNameGestures("Әлия", findLetterByLabel, null);
  assert.deepEqual(kazakh.skipped, ["Ә"]);
  assert.deepEqual(kazakh.letters.map((letter) => letter.label), ["Л", "И", "Я"]);
  const onlyRecorded = buildNameGestures("Анна", findLetterByLabel, new Set(["letter-1"]));
  assert.deepEqual(onlyRecorded.skipped, ["Н"]);

  const lesson = mockLessons.find((item) => item.personalized === "name")!;
  const personal = personalizeLesson(lesson, anna);
  assert.equal(personal.gestures.length, lesson.gestures.length + 4);
  assert.equal(personal.theoryGestures?.length, lesson.gestures.length + 2);
  assert.equal(personalizeLesson(lesson, null).needsName, true);
});

test("alphabet section teaches all 33 letters, three new letters per learning lesson", () => {
  const alphabetLessons = mockLessons.filter((lesson) => lesson.sectionId === "alphabet");
  assert.equal(alphabetLessons.length, 16);
  const learned = new Set(
    alphabetLessons.filter((lesson) => lesson.type === "learning").flatMap((lesson) => lesson.gestures.map((gesture) => gesture.label)),
  );
  assert.equal(learned.size, 33);
  for (const lesson of alphabetLessons.filter((item) => item.type === "learning"))
    assert.equal(lesson.gestures.length, 3, `lesson ${lesson.title}`);
  assert.equal(new Set(mockLessons.map((lesson) => lesson.id)).size, mockLessons.length, "lesson ids are unique");
});
