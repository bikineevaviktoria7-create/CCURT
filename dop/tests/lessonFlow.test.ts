import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { accountId, setMockAccount } from "./helpers/mockAccount.ts";
import {
  initialSession,
  lessonSessionReducer,
} from "../../src/hooks/useLessonSession.ts";
import {
  calculateLessonResult,
  emptyProgress,
  lessonStatus,
  progressService,
} from "../../src/services/progressService.ts";
import { lessons } from "../../src/data/lessons.ts";
import { buildSpelledName, personalizeLesson } from "../../src/lib/nameLesson.ts";
import { findLetterByLabel } from "../../src/data/alphabet.ts";
import type { GestureAttempt } from "../../src/types/progress.ts";

beforeEach(setMockAccount);

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
  assert.equal(state.phase, "prepare");
  for (const remaining of [3, 2, 1]) {
    assert.equal(state.countdown, remaining);
    assert.equal(lessonSessionReducer(state, { type: "ACCEPT", attempt: correct }), state);
    assert.equal(state.attempts.length, 0);
    state = lessonSessionReducer(state, { type: "COUNTDOWN_TICK" });
  }
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
    if (index < 2) {
      assert.equal(state.phase, "prepare");
      for (const remaining of [3, 2, 1]) {
        assert.equal(state.countdown, remaining);
        assert.equal(lessonSessionReducer(state, { type: "ACCEPT", attempt: correct }), state);
        assert.equal(lessonSessionReducer(state, { type: "START_PRACTICE" }), state);
        state = lessonSessionReducer(state, { type: "COUNTDOWN_TICK" });
      }
      assert.equal(state.countdown, 0);
    }
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
  assert.equal(skipped.stars, 0);
});

test("completion persists once and unlocks only the next lesson", () => {
  const result = calculateLessonResult("1", [correct], 0, "unique-session");
  const initial = emptyProgress();
  const first = lessons[0]!;
  const second = lessons[1]!;
  assert.equal(lessonStatus(first, lessons, initial), "current");
  assert.equal(lessonStatus(second, lessons, initial), "locked");
  progressService.completeLesson(accountId, result);
  const persisted = progressService.completeLesson(accountId, result);
  assert.equal(persisted.sessions.length, 1);
  assert.equal(lessonStatus(first, lessons, persisted), "completed");
  assert.equal(lessonStatus(second, lessons, persisted), "current");
  assert.equal(lessonStatus(lessons[2]!, lessons, persisted), "locked");
});

test("own-name lesson spells the name and skips unsupported letters", () => {
  const anna = buildSpelledName("Анна Иванова", findLetterByLabel, null);
  assert.deepEqual(anna.letters.map((letter) => letter.label), ["А", "Н", "Н", "А"]);
  assert.deepEqual(anna.skipped, []);
  const kazakh = buildSpelledName("Әлия", findLetterByLabel, null);
  assert.deepEqual(kazakh.skipped, ["Ә"]);
  assert.deepEqual(kazakh.letters.map((letter) => letter.label), ["Л", "И", "Я"]);
  const onlyRecorded = buildSpelledName("Анна", findLetterByLabel, new Set(["letter-1"]));
  assert.deepEqual(onlyRecorded.skipped, ["Н"]);

  const lesson = { ...lessons[0]!, personalized: "name" as const };
  const personal = personalizeLesson(lesson, anna);
  assert.equal(personal.gestures.length, lesson.gestures.length + 4);
  assert.equal(personal.theoryGestures?.length, lesson.gestures.length + 2);
  assert.equal(personalizeLesson(lesson, null).needsName, true);
});

test("alphabet section teaches all 33 letters, three new letters per learning lesson", () => {
  const alphabetLessons = lessons.filter((lesson) => lesson.sectionId === "alphabet");
  assert.equal(alphabetLessons.length, 16);
  const learned = new Set(
    alphabetLessons.filter((lesson) => lesson.type === "learning").flatMap((lesson) => lesson.gestures.map((gesture) => gesture.label)),
  );
  assert.equal(learned.size, 33);
  for (const lesson of alphabetLessons.filter((item) => item.type === "learning"))
    assert.equal(lesson.gestures.length, 3, `lesson ${lesson.title}`);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, lessons.length, "lesson ids are unique");
});

test("skipping preserves the existing advance behavior without a success countdown", () => {
  const state = { ...initialSession(0), phase: "practice" as const };
  const skipped = lessonSessionReducer(state, { type: "ACCEPT", attempt: { ...correct, success: false, skipped: true } });
  const next = lessonSessionReducer(skipped, { type: "ADVANCE", total: 3 });
  assert.equal(next.phase, "practice");
  assert.equal(next.currentGestureIndex, 1);
  assert.equal(next.countdown, 0);
  assert.equal(lessonSessionReducer(next, { type: "COUNTDOWN_TICK" }), next);
});

test("lesson two changes only the letter order, not the curriculum or gesture IDs", () => {
  const second = lessons.find(lesson => lesson.id === "2")!;
  assert.deepEqual(second.gestures.map(gesture => gesture.label), ["Г", "И", "Е"]);
  assert.deepEqual(second.gestures.map(gesture => gesture.id), ["letter-4", "letter-6", "letter-5"]);
  const repetition = lessons.filter(lesson => lesson.sectionId === "alphabet" && lesson.type === "practice");
  assert.equal(repetition.length, 5);
});


test("sections unlock independently while retaining completed lesson IDs", () => {
  const initial = emptyProgress();
  const alphabet = lessons.filter(item => item.sectionId === "alphabet");
  const words = lessons.filter(item => item.sectionId !== "alphabet");
  for (const section of [alphabet, words]) {
    assert.equal(lessonStatus(section[0]!, lessons, initial), "current");
    for (const lesson of section.slice(1)) assert.equal(lessonStatus(lesson, lessons, initial), "locked");
  }
  const progress = progressService.completeLesson(accountId, calculateLessonResult(words[0]!.id, [correct], 0, "words"));
  assert.equal(lessonStatus(words[0]!, lessons, progress), "completed");
  assert.equal(lessonStatus(words[1]!, lessons, progress), "current");
  assert.equal(lessonStatus(words[2]!, lessons, progress), "locked");
  assert.equal(lessonStatus(alphabet[0]!, lessons, progress), "current");
  assert.equal(lessonStatus(alphabet[1]!, lessons, progress), "locked");
});


test("word curriculum contains six independent sequential topics without remapping old progress", () => {
  const words = lessons.filter(lesson => lesson.sectionId === "words");
  assert.equal(lessons.length, 22);
  assert.deepEqual(words.map(lesson => lesson.title), ["Привет", "Пока", "Да", "Нет", "Повторение", "Итоговый урок"]);
  assert.deepEqual(words.map(lesson => lesson.number), [1, 2, 3, 4, 5, 6]);
  // Слово изучается целиком, а практикуется дактилем по буквам.
  assert.deepEqual(words.slice(0, 4).map(lesson => lesson.gestures.map(gesture => gesture.label).join("")), ["ПРИВЕТ", "ПОКА", "ДА", "НЕТ"]);
  for (const lesson of words.slice(0, 4)) {
    assert.equal(lesson.theoryGestures?.length, 1);
    assert.equal(lesson.theoryGestures?.[0]?.category, "word");
    assert.ok(lesson.theoryGestures?.[0]?.referenceMedia, "word lesson shows the spelled sequence");
    assert.ok(lesson.gestures.every(gesture => gesture.category === "letter"));
  }
  const letterIds = words.slice(0, 4).flatMap(lesson => lesson.gestures.map(gesture => gesture.id));
  const wordIds = words.slice(0, 4).map(lesson => lesson.theoryGestures![0]!.id);
  for (const lesson of words.slice(4)) {
    assert.equal(lesson.type, "practice");
    assert.deepEqual(lesson.gestures.map(gesture => gesture.id), letterIds);
    assert.deepEqual(lesson.theoryGestures?.map(gesture => gesture.id), wordIds);
  }
  assert.ok(words.every(lesson => !/^\d+$/.test(lesson.id)), "old word results keep their own IDs");
});
