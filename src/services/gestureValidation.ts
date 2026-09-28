import { isRecord } from "../lib/storage.ts";
import { FEATURE_COUNT, FEATURE_VERSION } from "../vision/features.ts";
import { MOTION_FEATURE_COUNT } from "../vision/dynamicMatcher.ts";
import { errorLabels } from "./progressService.ts";
import type { GestureBundle } from "./gestureRepository";

export const GESTURE_BUNDLE_VERSION = 1;
const identifier = (value: unknown) => typeof value === "string" && value.trim().length > 0 &&
  !["__proto__", "prototype", "constructor"].includes(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const vector = (value: unknown, size: number) =>
  Array.isArray(value) && value.length === size && Array.from(value).every(finite);
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
function finiteLandmarkNumbers(value: unknown, ancestors = new Set<object>()): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null || typeof value !== "object") return true;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const values: unknown[] = Array.isArray(value) ? Array.from(value) : Object.values(value);
  const valid = values.every((item) => finiteLandmarkNumbers(item, ancestors));
  ancestors.delete(value);
  return valid;
}

/** Validate the entire file before any local or remote mutation. */
export function validateGestureBundle(value: unknown): asserts value is GestureBundle {
  if (!isRecord(value) || !["version", "exportedAt", "gestures", "samples"].every((key) => Object.hasOwn(value, key)) ||
    value.version !== GESTURE_BUNDLE_VERSION ||
    (value.exportedAt !== null && !date(value.exportedAt)) ||
    !Array.isArray(value.samples) || !Array.isArray(value.gestures))
    throw new Error("Неверный формат или версия файла эталонов SignStep.");
  if (value.tolerance !== undefined && (!finite(value.tolerance) || value.tolerance <= 0))
    throw new Error("Допуск распознавания должен быть положительным числом.");

  for (const [index, sample] of value.samples.entries()) {
    const prefix = `Эталон ${index + 1}: `;
    if (!isRecord(sample) || !["id", "gestureId", "featureVersion"].every((key) => Object.hasOwn(sample, key)) ||
      !identifier(sample.id) || !identifier(sample.gestureId))
      throw new Error(prefix + "неверный идентификатор или отсутствуют обязательные поля.");
    if (sample.featureVersion !== FEATURE_VERSION)
      throw new Error(prefix + `несовместимая версия признаков. Ожидается ${FEATURE_VERSION}.`);
    const hasStatic = sample.features !== undefined;
    const hasDynamic = sample.sequence !== undefined;
    if (!hasStatic && !hasDynamic) throw new Error(prefix + "нет признаков жеста или движения.");
    if (hasStatic && !vector(sample.features, FEATURE_COUNT))
      throw new Error(prefix + `признаки должны содержать ${FEATURE_COUNT} конечных чисел.`);
    if (hasDynamic && (!Array.isArray(sample.sequence) || sample.sequence.length === 0 ||
      !Array.from(sample.sequence).every((frame: unknown) => vector(frame, MOTION_FEATURE_COUNT))))
      throw new Error(prefix + `каждый кадр движения должен содержать ${MOTION_FEATURE_COUNT} конечных чисел.`);
    if ((hasDynamic || sample.durationMs !== undefined) && (!finite(sample.durationMs) || sample.durationMs <= 0))
      throw new Error(prefix + "длительность движения должна быть положительным числом.");
    if (sample.handedness !== undefined && sample.handedness !== "left" && sample.handedness !== "right")
      throw new Error(prefix + "неверно указана ведущая рука.");
    if (sample.createdAt !== undefined && !date(sample.createdAt))
      throw new Error(prefix + "неверная дата записи.");
    if (!finiteLandmarkNumbers(sample.landmarks))
      throw new Error(prefix + "координаты содержат некорректные числа или циклические данные.");
  }
  for (const [index, gesture] of value.gestures.entries()) {
    if (!isRecord(gesture) || !Object.hasOwn(gesture, "id") || !identifier(gesture.id) ||
      (gesture.description !== undefined && typeof gesture.description !== "string") ||
      (gesture.imageUrl !== undefined && typeof gesture.imageUrl !== "string") ||
      (gesture.hints !== undefined && (!isRecord(gesture.hints) ||
        !Object.entries(gesture.hints).every(([code, message]) => Object.hasOwn(errorLabels, code) && typeof message === "string"))))
      throw new Error(`Описание жеста ${index + 1}: неверные поля или подсказки.`);
  }
}
