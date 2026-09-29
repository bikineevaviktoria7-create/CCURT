import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";
import type { feedback as Feedback } from "../../src/lib/feedback";

test("sounds require an unlocked context, respect mute, throttle hints and release audio nodes", () => {
  let enabled = true;
  let now = 0;
  let contexts = 0;
  let released = 0;
  const notes: number[] = [];
  const peaks: number[] = [];
  class AudioContextDouble {
    currentTime = 0;
    state = "suspended";
    destination = {};
    constructor() { contexts++; }
    async resume() { this.state = "running"; }
    createOscillator() {
      return {
        type: "sine", frequency: { value: 0 }, onended: () => {},
        connect: (gain: unknown) => gain,
        disconnect: () => { released++; },
        start() { notes.push(this.frequency.value); },
        stop() { this.onended(); },
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, linearRampToValueAtTime(value: number) { peaks.push(value); }, exponentialRampToValueAtTime() {} },
        connect() {}, disconnect() { released++; },
      };
    }
  }
  const { feedback } = loadBrowserModule<{ feedback: typeof Feedback }>("src/lib/feedback.ts", {
    "../services/settingsService": { settingsService: { get: () => ({ soundEnabled: enabled, speechEnabled: false }) } },
  }, { AudioContext: AudioContextDouble, window: {}, performance: { now: () => now } });
  feedback.success("А");
  assert.equal(contexts, 0);
  assert.equal(notes.length, 0);
  feedback.unlock();
  feedback.success("А");
  assert.deepEqual(notes, [660, 880]);
  feedback.hint();
  for (let i = 0; i < 30; i++) { now += 50; feedback.hint(); }
  assert.equal(notes.length, 3);
  now = 2100;
  feedback.hint();
  assert.equal(notes.length, 4);
  feedback.lessonComplete();
  assert.deepEqual(notes.slice(-4), [523, 659, 784, 1047]);
  assert.equal(released, notes.length * 2);
  assert.ok(Math.max(...peaks) <= 0.16);
  enabled = false;
  feedback.success("Б");
  feedback.lessonComplete();
  assert.equal(notes.length, 8);
  assert.equal(contexts, 1);
});
