import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";
import type { RecognitionResult, RecognitionStatus } from "../../src/types/vision.ts";
import type { RecognizerOptions } from "../../src/vision/recognizer.ts";

const options: RecognizerOptions = {
  targetId: "letter-1", targetLabel: "А", targetKind: "static", labels: {},
  staticModels: new Map(), dynamicModels: new Map(), dominantHand: "right",
};

function harness(load: () => Promise<unknown> = async () => ({})) {
  let time = 0;
  let status: RecognitionStatus = "searching";
  let processed = 0;
  let fail = false;
  const loops = new Set<() => void>();
  const results: RecognitionResult[] = [];
  const drawn: (RecognitionStatus | undefined)[] = [];
  const errors: unknown[] = [];
  const module = loadBrowserModule<typeof import("../../src/integrations/mediaPipeVisionAdapter.ts")>("src/integrations/mediaPipeVisionAdapter.ts", {
    "./visionAdapter": {},
    "../vision/landmarkers": {
      getHandLandmarker: load,
      detectHands: () => { if (fail) throw new Error("Frame failed"); return []; },
      measureBrightness: () => 120,
      onVideoFrames: (_video: unknown, callback: () => void, onError: (error: unknown) => void) => {
        const tick = () => { try { callback(); } catch (error) { onError(error); } };
        loops.add(tick);
        return () => { loops.delete(tick); };
      },
    },
    "../vision/recognizer": {
      pickHand: () => undefined,
      createGestureRecognizer: () => ({
        reset() {},
        recognizeFrame() { processed += 1; return { status, targetGesture: "А", confidence: 0.9, holdProgress: status === "success" ? 1 : 0 }; },
      }),
    },
  }, { performance: { now: () => time } });
  return {
    adapter: module.createMediaPipeVision(options, {
      onResult: (result) => results.push(result),
      onFrame: () => { drawn.push(results.at(-1)?.status); },
      onError: (error) => errors.push(error),
    }), loops, results, drawn, errors,
    frames: () => processed,
    fail: () => { fail = true; },
    recover: () => { fail = false; },
    tick: (now: number, next: RecognitionStatus = "searching") => {
      time = now; status = next; for (const tick of [...loops]) tick();
    },
  };
}

test("status oscillations are throttled while every CV frame is processed and success is immediate", async () => {
  const h = harness();
  const { results, drawn } = h;
  await h.adapter.start({} as HTMLVideoElement);
  for (let t = 0; t <= 1000; t += 20) h.tick(t, t % 40 ? "almost" : "searching");
  assert.equal(h.frames(), 51);
  assert.equal(drawn.length, 51);
  assert.equal(results.length, 11);
  h.tick(1001, "success");
  assert.equal(results.at(-1)?.status, "success");
  assert.equal(results.length, 12);
  assert.equal(drawn.at(-1), "success");
  assert.equal(h.loops.size, 0);
});

test("adapter retries initialization and runtime errors without duplicate loops", async () => {
  let loads = 0;
  const h = harness(async () => { if (++loads === 1) throw new Error("Load failed"); return {}; });
  await assert.rejects(h.adapter.initialize(), /Load failed/);
  await h.adapter.start({} as HTMLVideoElement);
  assert.equal(h.loops.size, 1);
  h.fail(); h.tick(1);
  assert.equal(h.errors.length, 1);
  assert.equal(h.loops.size, 0);
  h.recover();
  await h.adapter.start({} as HTMLVideoElement);
  await h.adapter.start({} as HTMLVideoElement);
  assert.equal(h.loops.size, 1);
  h.tick(2);
  assert.equal(h.frames(), 1);
  h.adapter.stop();
  assert.equal(h.loops.size, 0);
});

test("stop during asynchronous startup prevents a late frame loop", async () => {
  let resolve!: (value: unknown) => void;
  const h = harness(() => new Promise((done) => { resolve = done; }));
  const pending = h.adapter.start({} as HTMLVideoElement);
  h.adapter.stop();
  resolve({});
  await pending;
  assert.equal(h.loops.size, 0);
});

test("failed MediaPipe fileset load is retried rather than cached forever", async () => {
  let filesets = 0;
  const model = {};
  const { getHandLandmarker } = loadBrowserModule<typeof import("../../src/vision/landmarkers.ts")>("src/vision/landmarkers.ts", {
    "@mediapipe/tasks-vision": {
      FilesetResolver: { forVisionTasks: async () => { if (++filesets === 1) throw new Error("Offline"); return {}; } },
      HandLandmarker: { createFromOptions: async () => model },
    },
    "./normalize": {},
  }, { fetch: async () => ({ ok: true, headers: { get: () => "application/octet-stream" }, arrayBuffer: async () => new ArrayBuffer(1) }) });
  await assert.rejects(getHandLandmarker(), /Offline/);
  assert.equal(await getHandLandmarker(), model);
  assert.equal(filesets, 2);
});

for (const rvfc of [false, true]) {
  test(`frame error stops scheduling (${rvfc ? "rVFC" : "rAF"}) and reports failure once`, () => {
    let scheduled = 0;
    let failures = 0;
    class Video {
      readyState = 2;
      currentTime = 0;
      videoWidth = 640;
      videoHeight = 480;
      paused = false;
      ended = false;
    }
    if (rvfc) Object.assign(Video.prototype, {
      requestVideoFrameCallback: () => ++scheduled,
      cancelVideoFrameCallback: () => {},
    });
    const { onVideoFrames } = loadBrowserModule<typeof import("../../src/vision/landmarkers.ts")>("src/vision/landmarkers.ts", {
      "@mediapipe/tasks-vision": {}, "./normalize": {},
    }, {
      HTMLVideoElement: Video,
      requestAnimationFrame: () => ++scheduled,
      cancelAnimationFrame: () => {},
    });
    const stop = onVideoFrames(new Video() as HTMLVideoElement, () => { throw new Error("frame"); }, () => { failures += 1; });
    assert.equal(failures, 1);
    assert.equal(scheduled, 0);
    stop();
  });
}

test("frame loop waits for dimensions and playback, and cancels its pending callback", () => {
  let next: (() => void) | undefined;
  let calls = 0;
  let cancelled = 0;
  class Video { readyState = 2; videoWidth = 0; videoHeight = 0; paused = false; ended = false; currentTime = 0; }
  const { onVideoFrames } = loadBrowserModule<typeof import("../../src/vision/landmarkers.ts")>("src/vision/landmarkers.ts", {
    "@mediapipe/tasks-vision": {}, "./normalize": {},
  }, { HTMLVideoElement: Video, requestAnimationFrame: (callback: () => void) => { next = callback; return 7; }, cancelAnimationFrame: (id: number) => { cancelled = id; } });
  const video = new Video();
  const stop = onVideoFrames(video as HTMLVideoElement, () => { calls += 1; });
  assert.equal(calls, 0);
  video.videoWidth = 640; video.videoHeight = 480; video.paused = true;
  next?.(); assert.equal(calls, 0);
  video.paused = false; next?.(); assert.equal(calls, 1);
  next?.(); assert.equal(calls, 1);
  video.currentTime = 1; next?.(); assert.equal(calls, 2);
  stop(); assert.equal(cancelled, 7);
  video.currentTime = 2; next?.(); assert.equal(calls, 2);
});

test("production never falls back to mock recognition, even without options", () => {
  let mock = 0;
  const { createVisionAdapter } = loadBrowserModule<typeof import("../../src/integrations/mediaPipeVisionAdapter.ts")>("src/integrations/mediaPipeVisionAdapter.ts", {
    "./visionAdapter": { createMockVision: () => { mock += 1; } },
    "../vision/landmarkers": {},
    "../vision/recognizer": { createGestureRecognizer: () => ({}) },
  }, { __env: { DEV: false } });
  const gesture = { id: "letter-1", label: "А", kind: "static" } as import("../../src/types/lesson.ts").Gesture;
  const callbacks = { onResult() {}, onFrame() {}, onError() {} };
  assert.equal(createVisionAdapter(gesture, "real", callbacks).mode, "real");
  assert.equal(createVisionAdapter(gesture, "demo", callbacks).mode, "real");
  assert.equal(mock, 0);
});


test("paused adapter does not process or publish incorrect frames before preparation ends", async () => {
  const h = harness();
  h.adapter.pause(true);
  await h.adapter.start({} as HTMLVideoElement);
  for (let time = 0; time < 1950; time += 50) h.tick(time, "incorrect");
  assert.equal(h.frames(), 0);
  assert.equal(h.results.length, 0);
  h.adapter.pause(false);
  h.tick(1950, "searching");
  assert.equal(h.frames(), 1);
  assert.equal(h.results[0]?.status, "searching");
  h.tick(2600, "success");
  assert.equal(h.results.at(-1)?.status, "success");
  h.adapter.stop();
});
