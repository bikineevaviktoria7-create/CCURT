import type { HandLandmark } from "../types/vision";

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
  landmarks: readonly HandLandmark[];
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
