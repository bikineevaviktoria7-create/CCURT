import type { Point3 } from "../vision/types";

const connections = [
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
  // Match object-fit: contain, including any letterboxing from negotiated camera dimensions.
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
  for (const [from = 0, to = 0] of connections) {
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

// Одинаковые размеры, зеркальность и цвета в уроке и при записи эталонов.
export function createSkeletonOverlay(video: HTMLVideoElement | null, canvas: HTMLCanvasElement | null) {
  const ctx = canvas?.getContext("2d");
  if (!video || !canvas || !ctx) return;
  const style = getComputedStyle(document.documentElement);
  const colors = {
    neutral: style.getPropertyValue("--color-skeleton-neutral").trim(),
    correct: style.getPropertyValue("--color-skeleton-correct").trim(),
    incorrect: style.getPropertyValue("--color-skeleton-incorrect").trim(),
  };
  let landmarks: readonly Point3[] = [];
  let highlights: Pick<SkeletonOptions, "incorrectLandmarks" | "correctLandmarks"> = {};
  function redraw() {
    if (!video || !canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawHandSkeleton({
      ctx, landmarks, width, height, mirrored: true, colors, ...highlights,
      sourceWidth: video.videoWidth || 640, sourceHeight: video.videoHeight || 480,
    });
  }
  const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(redraw);
  observer?.observe(canvas);
  redraw();
  return {
    draw(points: readonly Point3[], nextHighlights: typeof highlights = {}) {
      landmarks = points;
      highlights = nextHighlights;
      redraw();
    },
    dispose() { observer?.disconnect(); },
  };
}
