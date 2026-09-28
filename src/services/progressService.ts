import { canReadProgress, canUsePlatform, currentUser } from "./accessService.ts";
import { isRecord, storage } from "../lib/storage.ts";
import type {
  GestureAttempt,
  LearningProgress,
  LessonResult,
  LessonProgress,
} from "../types/progress";
import type { GestureErrorCode } from "../types/vision";
import type { Lesson } from "../types/lesson";

export const errorLabels: Record<GestureErrorCode, string> = {
  FINGER_NOT_BENT: "Сгибание пальцев",
  FINGER_NOT_STRAIGHT: "Выпрямление пальцев",
  THUMB_POSITION: "Положение большого пальца",
  FINGER_SPREAD: "Расстояние между пальцами",
  PALM_ORIENTATION: "Поворот ладони",
  HAND_LOCATION: "Положение руки",
  AMPLITUDE: "Амплитуда движения",
  SPEED: "Скорость движения",
  HAND_OUT_OF_FRAME: "Рука вне кадра",
  LOW_LIGHT: "Освещение",
  WRONG_HAND: "Выбор руки",
  WRONG_GESTURE: "Показан другой жест",
};
export const emptyProgress = (): LearningProgress => ({
  lessons: {},
  sessions: [],
  lastLessonId: null,
});

const hasFields = (value: Record<string, unknown>, fields: readonly string[]) =>
  fields.every((field) => Object.hasOwn(value, field));
const validId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  !["__proto__", "prototype", "constructor"].includes(value);
const numberIn = (value: unknown, min: number, max = Infinity): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const validDate = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
const validMode = (value: Record<string, unknown>) =>
  !("mode" in value) || (Object.hasOwn(value, "mode") && (value.mode === "real" || value.mode === "demo"));

export function isGestureAttempt(value: unknown): value is GestureAttempt {
  return isRecord(value) &&
    hasFields(value, ["gestureId", "success", "skipped", "errorCodes", "durationMs"]) &&
    validId(value.gestureId) && typeof value.success === "boolean" &&
    typeof value.skipped === "boolean" && !(value.success && value.skipped) &&
    numberIn(value.durationMs, 0) && validMode(value) &&
    (!("confidence" in value) || (Object.hasOwn(value, "confidence") && numberIn(value.confidence, 0, 1))) &&
    Array.isArray(value.errorCodes) && Array.from(value.errorCodes).every(
      (code: unknown) => typeof code === "string" && Object.hasOwn(errorLabels, code),
    );
}

export function isLessonResult(value: unknown): value is LessonResult {
  return isRecord(value) &&
    hasFields(value, ["sessionId", "lessonId", "completedAt", "score", "accuracy", "stars", "durationMs", "attempts"]) &&
    validId(value.sessionId) && validId(value.lessonId) && validDate(value.completedAt) &&
    numberIn(value.score, 0, 1000) && numberIn(value.accuracy, 0, 100) &&
    numberIn(value.stars, 1, 3) && Number.isInteger(value.stars) &&
    numberIn(value.durationMs, 0) && validMode(value) &&
    Array.isArray(value.attempts) && Array.from(value.attempts).every(isGestureAttempt);
}

function isLessonProgress(value: unknown): value is LessonProgress {
  return isRecord(value) &&
    hasFields(value, ["lessonId", "completedAt", "bestScore", "bestAccuracy", "stars"]) &&
    validId(value.lessonId) && validDate(value.completedAt) &&
    numberIn(value.bestScore, 0, 1000) && numberIn(value.bestAccuracy, 0, 100) &&
    numberIn(value.stars, 0, 3) && Number.isInteger(value.stars);
}

export function isDemoResult(result: LessonResult) {
  return result.mode === "demo" || result.attempts.some((attempt) => attempt.mode === "demo");
}

export function calculateLessonResult(
  lessonId: string,
  attempts: GestureAttempt[],
  startedAt: number,
  sessionId: string,
): LessonResult {
  let earnedPoints = 0;
  for (const attempt of attempts) {
    if (attempt.success) earnedPoints += Math.max(60, 100 - attempt.errorCodes.length * 8);
  }
  const accuracy = attempts.length ? Math.round(earnedPoints / attempts.length) : 0;
  return {
    sessionId,
    lessonId,
    mode: attempts.some((attempt) => attempt.mode === "demo") ? "demo" : "real",
    completedAt: new Date().toISOString(),
    accuracy,
    score: accuracy * 10,
    stars: accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1,
    durationMs: Date.now() - startedAt,
    attempts,
  };
}

export function frequentErrors(attempts: readonly GestureAttempt[]) {
  const counts = new Map<GestureErrorCode, number>();
  for (const attempt of attempts)
    for (const code of attempt.errorCodes)
      counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ label: errorLabels[code], count }));
}

export function lessonStatus(
  lesson: Lesson,
  lessons: readonly Lesson[],
  progress: LearningProgress,
) {
  if (progress.lessons[lesson.id]) return "completed";
  const next = lessons.find((item) => !progress.lessons[item.id]);
  if (lesson.id === next?.id) return "current";
  return canUsePlatform(currentUser()) ? "available" : "locked";
}

function applyResult(progress: LearningProgress, result: LessonResult) {
  if (!isLessonResult(result) || isDemoResult(result)) return false;
  if (progress.sessions.some((session) => session.sessionId === result.sessionId))
    return false;
  const previous = progress.lessons[result.lessonId];
  progress.lessons[result.lessonId] = {
    lessonId: result.lessonId,
    completedAt: previous && previous.completedAt > result.completedAt ? previous.completedAt : result.completedAt,
    stars: Math.max(previous?.stars ?? 0, result.stars) as 1 | 2 | 3,
    bestScore: Math.max(previous?.bestScore ?? 0, result.score),
    bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, result.accuracy),
  };
  progress.sessions.push(result);
  progress.lastLessonId = result.lessonId;
  return true;
}

export const progressService = {
  getProgress(userId: string): LearningProgress {
    if (!canReadProgress(userId)) return emptyProgress();
    const value = storage.read(`progress:${userId}`);
    if (
      !isRecord(value) ||
      !hasFields(value, ["lessons", "sessions"]) ||
      !isRecord(value.lessons) ||
      !Array.isArray(value.sessions)
    )
      return emptyProgress();
    const lessons: LearningProgress["lessons"] = {};
    for (const [id, item] of Object.entries(value.lessons)) {
      if (validId(id) && isLessonProgress(item) && item.lessonId === id)
        lessons[id] = item;
    }
    const validSessions = value.sessions.filter(isLessonResult);
    const sessions = validSessions.filter((item) => !isDemoResult(item));
    // Repair aggregates if explicitly marked demo data was persisted previously.
    const demoLessons = new Set(validSessions.filter(isDemoResult).map((item) => item.lessonId));
    const rebuilt = emptyProgress();
    for (const session of sessions) if (demoLessons.has(session.lessonId)) applyResult(rebuilt, session);
    for (const id of demoLessons) {
      delete lessons[id];
      if (Object.hasOwn(rebuilt.lessons, id)) lessons[id] = rebuilt.lessons[id]!;
    }
    return {
      lessons,
      sessions,
      lastLessonId: Object.hasOwn(value, "lastLessonId") && validId(value.lastLessonId) &&
        Object.hasOwn(lessons, value.lastLessonId) ? value.lastLessonId : null,
    };
  },
  getResult(userId: string, sessionId: string): LessonResult | undefined {
    if (!canReadProgress(userId)) return undefined;
    const real = this.getProgress(userId).sessions.find((item) => item.sessionId === sessionId);
    if (real) return real;
    const demo = storage.read(`demo-result:${userId}:${sessionId}`);
    return isLessonResult(demo) && isDemoResult(demo) && demo.sessionId === sessionId ? demo : undefined;
  },
  completeLesson(userId: string, result: LessonResult) {
    if (!canReadProgress(userId)) return emptyProgress();
    const progress = this.getProgress(userId);
    if (isLessonResult(result) && isDemoResult(result)) {
      storage.write(`demo-result:${userId}:${result.sessionId}`, result);
      return progress;
    }
    if (!applyResult(progress, result)) return progress;
    storage.write(`progress:${userId}`, progress);
    return progress;
  },
  /** Adds results from another device or the guest profile; duplicates are ignored. */
  mergeResults(userId: string, results: readonly LessonResult[]) {
    if (!canReadProgress(userId)) return emptyProgress();
    const progress = this.getProgress(userId);
    const sorted = results.filter(isLessonResult).filter((result) => !isDemoResult(result)).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    let changed = false;
    for (const result of sorted) changed = applyResult(progress, result) || changed;
    if (changed) {
      progress.sessions.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
      storage.write(`progress:${userId}`, progress);
    }
    return progress;
  },
};


/** Consecutive days (ending today or yesterday) with at least one finished lesson. */
export function streakDays(sessions: readonly LessonResult[], now = new Date()) {
  const days = new Set(sessions.map((session) => new Date(session.completedAt).toDateString()));
  const cursor = new Date(now);
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
