import assert from "node:assert/strict";
import { test } from "node:test";
import { initialFeedback, updateFeedback } from "../../src/lib/feedbackHistory.ts";
import type { RecognitionResult } from "../../src/types/vision.ts";

const waiting: RecognitionResult = { status: "idle", targetLabel: "А", confidence: 0, holdProgress: 0 };
const correction: RecognitionResult = { ...waiting, status: "almost", errorCodes: ["PALM_ORIENTATION"], message: "Поверните ладонь", incorrectLandmarks: [0] };

test("identical corrections and confidence fluctuations do not flood history or flicker", () => {
  let state = initialFeedback(correction);
  for (let t = 0; t < 2000; t += 100) state = updateFeedback(state, { ...correction, status: t % 200 ? "almost" : "incorrect", confidence: t / 2000 }, t);
  assert.equal(state.history.length, 0);
  assert.equal(state.current.status, "almost");
});

test("a meaningful stable change moves the previous correction into bounded history", () => {
  let state = initialFeedback(correction);
  state = updateFeedback(state, { ...correction, message: "Другая подсказка" }, 0);
  assert.equal(state.current.message, correction.message);
  state = updateFeedback(state, correction, 100);
  assert.equal(state.history.length, 0);
  for (let i = 1; i <= 7; i++) {
    const next = { ...correction, message: `Подсказка ${i}` };
    state = updateFeedback(state, next, i * 1000);
    state = updateFeedback(state, next, i * 1000 + 350);
  }
  assert.equal(state.current.message, "Подсказка 7");
  assert.equal(state.history.length, 4);
  assert.equal(state.history[0]!.result.message, "Подсказка 6");
  assert.equal(state.history[0]!.corrected, false, "another error alone does not prove correction");
  state = updateFeedback(state, { ...waiting, status: "success" }, 7400);
  assert.equal(state.current.status, "success");
  assert.ok(state.history.every(item => item.corrected));
});

test("environment warnings are immediate; corrected landmarks support resolved history", () => {
  let state = initialFeedback(correction);
  state = updateFeedback(state, { ...waiting, status: "searching", correctLandmarks: [0] }, 0);
  state = updateFeedback(state, { ...waiting, status: "searching", correctLandmarks: [0] }, 350);
  assert.equal(state.history[0]!.corrected, true);
  state = updateFeedback(state, { ...waiting, status: "environment-error", errorCodes: ["LOW_LIGHT"] }, 400);
  assert.equal(state.current.status, "environment-error");
});
