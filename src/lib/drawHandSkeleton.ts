import type { Point3 } from "../vision/types";

const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
interface SkeletonOptions {
  ctx: CanvasRenderingContext2D;
  landmarks: readonly Point3[];
  width: number;
  height: number;
  mirrored: boolean;
  sourceWidth?: number;
  sourceHeight?: number;
  incorrectLandmarks?: readonly number[];
  correctLandmarks?: readonly number[];
  colors: { neutral: string; correct: string; incorrect: string };
}
/** Рисует точки и кости руки на canvas с учётом object-fit: contain у видео. */
export function drawHandSkeleton({
  ctx,
  landmarks,
  width,
  height,
  mirrored,
  sourceWidth = 640,
  sourceHeight = 480,
  incorrectLandmarks = [],
  correctLandmarks = [],
  colors,
}: SkeletonOptions) {
  ctx.clearRect(0, 0, width, height);
  // Повторяем object-fit: contain, включая поля от согласованного размера кадра камеры.
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale,
    h = sourceHeight * scale;
  const point = (index: number) => {
    const p = landmarks[index];
    return p
      ? {
          x: (width - w) / 2 + (mirrored ? 1 - p.x : p.x) * w,
          y: (height - h) / 2 + p.y * h,
        }
      : null;
  };
  const color = (index: number) =>
    incorrectLandmarks.includes(index)
      ? colors.incorrect
      : correctLandmarks.includes(index)
        ? colors.correct
        : colors.neutral;
  ctx.lineWidth = Math.max(3, width / 180);
  ctx.lineCap = "round";
  for (const [from = 0, to = 0] of HAND_CONNECTIONS) {
    const a = point(from),
      b = point(to);
    if (!a || !b) continue;
    ctx.strokeStyle = incorrectLandmarks.includes(to)
      ? colors.incorrect
      : color(from);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  landmarks.forEach((_, index) => {
    const p = point(index);
    if (!p) return;
    ctx.fillStyle = color(index);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(4, width / 140), 0, Math.PI * 2);
    ctx.fill();
  });
}

type SkeletonColors = SkeletonOptions["colors"];
type SkeletonHighlights = Pick<SkeletonOptions, "incorrectLandmarks" | "correctLandmarks">;

/** Скелет руки поверх видео камеры; перерисовывается при изменении размера canvas. */
export interface SkeletonOverlayApi {
  /** Заменяет точки и подсветку и перерисовывает canvas. */
  draw(nextLandmarks: readonly Point3[], nextHighlights?: SkeletonHighlights): void;
  /** Перестаёт следить за размером canvas. */
  dispose(): void;
}

// Одинаковые размеры, зеркальность и цвета в уроке и при записи эталонов.
export class SkeletonOverlay implements SkeletonOverlayApi {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private colors: SkeletonColors;
  private landmarks: readonly Point3[] = [];
  private highlights: SkeletonHighlights = {};
  private observer: ResizeObserver | undefined;

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = ctx;
    const style = getComputedStyle(document.documentElement);
    this.colors = {
      neutral: style.getPropertyValue("--color-skeleton-neutral").trim(),
      correct: style.getPropertyValue("--color-skeleton-correct").trim(),
      incorrect: style.getPropertyValue("--color-skeleton-incorrect").trim(),
    };
    this.observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(this.redraw);
    this.observer?.observe(canvas);
    this.redraw();
  }

  draw(nextLandmarks: readonly Point3[], nextHighlights: SkeletonHighlights = {}) {
    this.landmarks = nextLandmarks;
    this.highlights = nextHighlights;
    this.redraw();
  }

  dispose() { this.observer?.disconnect(); }

  /** Поле-стрелка: передаётся в `ResizeObserver`. */
  private redraw = () => {
    const { video, canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawHandSkeleton({
      ctx, landmarks: this.landmarks, width, height, mirrored: true, colors: this.colors, ...this.highlights,
      sourceWidth: video.videoWidth || 640, sourceHeight: video.videoHeight || 480,
    });
  };
}

/** Создаёт оверлей или возвращает `undefined`, если нет видео, canvas или 2D-контекста. */
export function createSkeletonOverlay(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
): SkeletonOverlayApi | undefined {
  const ctx = canvas?.getContext("2d");
  if (!video || !canvas || !ctx) return;
  return new SkeletonOverlay(video, canvas, ctx);
}
