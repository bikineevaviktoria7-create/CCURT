import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { resolveHandedness } from "./normalize";
import type { HandObservation } from "./types";

// Только для браузера: загружает MediaPipe один раз на страницу и превращает его сырой
// вывод в объекты HandObservation для чистого кода распознавания.

const BASE = import.meta.env.BASE_URL;
const WASM_PATH = `${BASE}mediapipe/wasm`;
const HAND_MODELS = [
  `${BASE}models/hand_landmarker.task`,
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
];

/** Сначала локальная модель (лежит в репозитории), CDN Google — запасной вариант. */
async function fetchModel(urls: readonly string[]) {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const type = response.headers.get("content-type") ?? "";
      // SPA-фолбэк отвечает на неизвестные пути страницей index.html — это не модель.
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

/** Общий HandLandmarker, создаётся один раз; неудачная загрузка повторяется при следующем вызове. */
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

// MediaPipe требует строго возрастающих меток времени во всех вызовах.
let lastTimestamp = 0;
function nextTimestamp() {
  const now = performance.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
}

/** Превращает сырой вывод MediaPipe в наблюдения рук, пропуская неполные руки. */
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

/** Находит руки на текущем кадре видео. */
export function detectHands(landmarker: HandLandmarker, video: HTMLVideoElement) {
  return toObservations(landmarker.detectForVideo(video, nextTimestamp()));
}

let probe: HTMLCanvasElement | null = null;
/** Средняя яркость 0–255 уменьшенной копии кадра. */
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

/** Вызывает `callback` на каждый новый кадр видео (через requestVideoFrameCallback, если он есть). */
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
