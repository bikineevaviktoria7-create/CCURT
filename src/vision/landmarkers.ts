import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { resolveHandedness } from "./normalize";
import type { HandObservation } from "./types";

// Browser-only: loads MediaPipe once per page and turns its raw output into
// HandObservation objects for the pure recognition code.

const BASE = import.meta.env.BASE_URL;
const WASM_PATH = `${BASE}mediapipe/wasm`;
const HAND_MODELS = [
  `${BASE}models/hand_landmarker.task`,
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
];

/** Local model first (committed to the repo); Google's CDN as a fallback. */
async function fetchModel(urls: readonly string[]) {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const type = response.headers.get("content-type") ?? "";
      // The SPA fallback answers unknown paths with index.html — that is not a model.
      if (!response.ok || type.includes("text/html")) throw new Error(`${url}: ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Модель не загружена");
}

let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
const getFileset = () => (fileset ??= FilesetResolver.forVisionTasks(WASM_PATH).catch((error: unknown) => {
  fileset = null;
  throw error;
}));

async function withDelegates<T>(create: (delegate: "GPU" | "CPU") => Promise<T>) {
  try {
    return await create("GPU");
  } catch (error) {
    console.warn("[SignStep] GPU недоступен, переключаемся на CPU", error);
    return create("CPU");
  }
}

let handPromise: Promise<HandLandmarker> | null = null;

/** Shared HandLandmarker, created once; a failed load is retried on the next call. */
export function getHandLandmarker() {
  handPromise ??= (async () => {
    const [files, model] = await Promise.all([getFileset(), fetchModel(HAND_MODELS)]);
    return withDelegates((delegate) =>
      HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetBuffer: model, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    );
  })().catch((error: unknown) => {
    handPromise = null;
    throw error;
  });
  return handPromise;
}

// MediaPipe requires strictly increasing timestamps across all calls.
let lastTimestamp = 0;
function nextTimestamp() {
  const now = performance.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
}

/** Converts raw MediaPipe hand output into observations, skipping incomplete hands. */
export function toObservations(result: HandLandmarkerResult): HandObservation[] {
  return result.landmarks.flatMap((image, index) => {
    const world = result.worldLandmarks[index];
    const category = result.handedness[index]?.[0];
    if (!world || image.length < 21 || world.length < 21) return [];
    return [
      {
        image: image.map(({ x, y, z }) => ({ x, y, z })),
        world: world.map(({ x, y, z }) => ({ x, y, z })),
        hand: resolveHandedness(category?.categoryName),
        score: category?.score ?? 0,
      },
    ];
  });
}

/** Detects hands on the current video frame. */
export function detectHands(landmarker: HandLandmarker, video: HTMLVideoElement) {
  return toObservations(landmarker.detectForVideo(video, nextTimestamp()));
}

let probe: HTMLCanvasElement | null = null;
/** Average brightness 0–255 of a tiny copy of the frame. */
export function measureBrightness(video: HTMLVideoElement) {
  probe ??= document.createElement("canvas");
  probe.width = 32;
  probe.height = 24;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(video, 0, 0, 32, 24);
  const { data } = context.getImageData(0, 0, 32, 24);
  let sum = 0;
  for (let index = 0; index < data.length; index += 4)
    sum += 0.299 * (data[index] ?? 0) + 0.587 * (data[index + 1] ?? 0) + 0.114 * (data[index + 2] ?? 0);
  return sum / (data.length / 4);
}

/** Calls `callback` for every new video frame (requestVideoFrameCallback when available). */
export function onVideoFrames(video: HTMLVideoElement, callback: () => void, onError?: (error: unknown) => void) {
  let active = true;
  let handle = 0;
  let lastTime = -1;
  const supportsRvfc = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
  const tick = () => {
    if (!active) return;
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && !video.paused && !video.ended && video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      try {
        callback();
      } catch (error) {
        if (onError) {
          active = false;
          onError(error);
        } else console.error("[SignStep] ошибка обработки кадра", error);
      }
    }
    if (!active) return;
    handle = supportsRvfc
      ? video.requestVideoFrameCallback(tick)
      : requestAnimationFrame(tick);
  };
  tick();
  return () => {
    active = false;
    if (supportsRvfc) video.cancelVideoFrameCallback(handle);
    else cancelAnimationFrame(handle);
  };
}
