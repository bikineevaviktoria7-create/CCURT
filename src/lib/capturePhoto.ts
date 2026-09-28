import type { Point3 } from "../vision/types";

/**
 * Crops the hand out of the current video frame, mirrored the way the learner
 * sees themselves, as a square ~600 px WebP (JPEG where WebP is unsupported).
 */
export async function captureHandPhoto(
  video: HTMLVideoElement,
  landmarks: readonly Point3[],
  size = 600,
): Promise<Blob> {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  const xs = landmarks.map((point) => point.x * width);
  const ys = landmarks.map((point) => point.y * height);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const side = Math.min(Math.max(maxX - minX, maxY - minY) * 1.6, width, height);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const sx = Math.min(Math.max(0, centerX - side / 2), width - side);
  const sy = Math.min(Math.max(0, centerY - side / 2), height - side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен");
  context.translate(size, 0);
  context.scale(-1, 1);
  context.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (blob && blob.type === "image/webp") return blob;
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  if (!jpeg) throw new Error("Не удалось сохранить фото");
  return jpeg;
}
