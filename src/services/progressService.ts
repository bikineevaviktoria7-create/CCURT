import { canReadProgress } from "./accessService.ts";
import { isRecord, storage } from "../lib/storage.ts";
import type {
  GestureAttempt,
  LearningProgress,
  LessonResult,
  LessonProgress,
} from "../types/progress";
import type { GestureErrorCode } from "../types/vision";
import type { Lesson } from "../types/lesson";

/** Short Russian names of error codes for statistics. */
export const ERROR_LABELS: Record<GestureErrorCode, string> = {
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
  START_POSITION: "Начальное положение", END_POSITION: "Завершение движения",
  WRONG_DIRECTION: "Направление движения", AMPLITUDE_TOO_SMALL: "Недостаточная амплитуда",
  AMPLITUDE_TOO_LARGE: "Избыточная амплитуда", TOO_FAST: "Слишком быстро",
  TOO_SLOW: "Слишком медленно", TRAJECTORY_MISMATCH: "Траектория движения",
  HAND_SHAPE_CHANGED: "Форма кисти в движении",
  INCOMPLETE_MOVEMENT: "Незавершённое движение",
  MOVEMENT_MISMATCH: "Сходство движения",
};
/** Progress of a learner who has not finished any lesson. */
export function emptyProgress(): LearningProgress {
  return {
    lessons: {},
    sessions: [],
    lastLessonId: null,
  };
}

const hasFields = (value: Record<string, unknown>, fields: readonly string[]) =>
  fields.every((field) => Object.hasOwn(value, field));
const isValidId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  !["__proto__", "prototype", "constructor"].includes(value);
const isNumberIn = (value: unknown, min: number, max = Infinity): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const isValidDate = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
const isValidMode = (value: Record<string, unknown>) =>
  !("mode" in value) || (Object.hasOwn(value, "mode") && (value.mode === "real" || value.mode === "demo"));

/** Validates one stored gesture attempt. */
export function isGestureAttempt(value: unknown): value is GestureAttempt {
  return isRecord(value) &&
    hasFields(value, ["gestureId", "success", "skipped", "errorCodes", "durationMs"]) &&
    isValidId(value.gestureId) && typeof value.success === "boolean" &&
    typeof value.skipped === "boolean" && !(value.success && value.skipped) &&
    isNumberIn(value.durationMs, 0) && isValidMode(value) &&
    (!("confidence" in value) || (Object.hasOwn(value, "confidence") && isNumberIn(value.confidence, 0, 1))) &&
    Array.isArray(value.errorCodes) && Array.from(value.errorCodes).every(
      (code: unknown) => typeof code === "string" && Object.hasOwn(ERROR_LABELS, code),
    );
}

/** Validates one stored lesson result, including its attempts. */
export function isLessonResult(value: unknown): value is LessonResult {
  return isRecord(value) &&
    hasFields(value, ["sessionId", "lessonId", "completedAt", "score", "accuracy", "stars", "durationMs", "attempts"]) &&
    isValidId(value.sessionId) && isValidId(value.lessonId) && isValidDate(value.completedAt) &&
    isNumberIn(value.score, 0, 1000) && isNumberIn(value.accuracy, 0, 100) &&
    isNumberIn(value.stars, 0, 3) && Number.isInteger(value.stars) &&
    isNumberIn(value.durationMs, 0) && isValidMode(value) &&
    Array.isArray(value.attempts) && Array.from(value.attempts).every(isGestureAttempt);
}

function isLessonProgress(value: unknown): value is LessonProgress {
  return isRecord(value) &&
    hasFields(value, ["lessonId", "completedAt", "bestScore", "bestAccuracy", "stars"]) &&
    isValidId(value.lessonId) && isValidDate(value.completedAt) &&
    isNumberIn(value.bestScore, 0, 1000) && isNumberIn(value.bestAccuracy, 0, 100) &&
    isNumberIn(value.stars, 0, 3) && Number.isInteger(value.stars);
}

/** True if the lesson was passed (at least one star); only such results count as progress. */
export function isPassedResult(result: LessonResult) {
  return result.stars > 0;
}

/** True if the result or any attempt was produced in demo mode. */
export function isDemoResult(result: LessonResult) {
  return result.mode === "demo" || result.attempts.some((attempt) => attempt.mode === "demo");
}

/** Score, accuracy and stars of a finished lesson. */
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
    stars: accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 40 ? 1 : 0,
    durationMs: Date.now() - startedAt,
    attempts,
  };
}

/** Error labels sorted by how often they occurred. */
export function frequentErrors(attempts: readonly GestureAttempt[]) {
  const counts = new Map<GestureErrorCode, number>();
  for (const attempt of attempts)
    for (const code of attempt.errorCodes)
      counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ label: ERROR_LABELS[code], count }));
}

/** Status of a lesson on the learning path. */
export function lessonStatus(
  lesson: Lesson,
  lessons: readonly Lesson[],
  progress: LearningProgress,
) {
  if (progress.lessons[lesson.id]) return "completed";
  const next = lessons.find((item) => item.sectionId === lesson.sectionId && !progress.lessons[item.id]);
  return lesson.id === next?.id ? "current" : "locked";
}

function applyResult(progress: LearningProgress, result: LessonResult) {
  if (!isLessonResult(result) || isDemoResult(result) || !isPassedResult(result)) return false;
  if (progress.sessions.some((session) => session.sessionId === result.sessionId))
    return false;
  const previous = progress.lessons[result.lessonId];
  progress.lessons[result.lessonId] = {
    lessonId: result.lessonId,
    completedAt: previous && previous.completedAt > result.completedAt ? previous.completedAt : result.completedAt,
    stars: previous && previous.stars > result.stars ? previous.stars : result.stars,
    bestScore: Math.max(previous?.bestScore ?? 0, result.score),
    bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, result.accuracy),
  };
  progress.sessions.push(result);
  progress.lastLessonId = result.lessonId;
  return true;
}

/** Key-value storage the progress is kept in. */
type ProgressStorage = Pick<typeof storage, "read" | "write">;

/** Lesson progress of a learner: reading, saving and merging results. */
export interface ProgressStore {
  getProgress(userId: string): LearningProgress;
  getResult(userId: string, sessionId: string): LessonResult | undefined;
  completeLesson(userId: string, result: LessonResult): LearningProgress;
  mergeResults(userId: string, results: readonly LessonResult[]): LearningProgress;
}

/** Reads and saves lesson progress of the current user in localStorage. */
export class ProgressService implements ProgressStore {
  private storage: ProgressStorage;
  private canReadProgress: (userId: string) => boolean;

  constructor(progressStorage: ProgressStorage, canRead: (userId: string) => boolean) {
    this.storage = progressStorage;
    this.canReadProgress = canRead;
  }

  getProgress(userId: string): LearningProgress {
    if (!this.canReadProgress(userId)) return emptyProgress();
    const value = this.storage.read(`progress:${userId}`);
    if (
      !isRecord(value) ||
      !hasFields(value, ["lessons", "sessions"]) ||
      !isRecord(value.lessons) ||
      !Array.isArray(value.sessions)
    )
      return emptyProgress();
    const lessons: LearningProgress["lessons"] = {};
    for (const [id, item] of Object.entries(value.lessons)) {
      if (isValidId(id) && isLessonProgress(item) && item.lessonId === id && item.stars > 0)
        lessons[id] = item;
    }
    const validSessions = value.sessions.filter(isLessonResult).filter(isPassedResult);
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
      lastLessonId: Object.hasOwn(value, "lastLessonId") && isValidId(value.lastLessonId) &&
        Object.hasOwn(lessons, value.lastLessonId) ? value.lastLessonId : null,
    };
  }

  getResult(userId: string, sessionId: string): LessonResult | undefined {
    if (!this.canReadProgress(userId)) return undefined;
    const real = this.getProgress(userId).sessions.find((item) => item.sessionId === sessionId);
    if (real) return real;
    const demo = this.storage.read(`demo-result:${userId}:${sessionId}`);
    if (isLessonResult(demo) && isDemoResult(demo) && demo.sessionId === sessionId) return demo;
    const failed = this.storage.read(`failed-result:${userId}:${sessionId}`);
    return isLessonResult(failed) && !isPassedResult(failed) && failed.sessionId === sessionId ? failed : undefined;
  }

  completeLesson(userId: string, result: LessonResult) {
    if (!this.canReadProgress(userId)) return emptyProgress();
    const progress = this.getProgress(userId);
    if (isLessonResult(result) && isDemoResult(result)) {
      this.storage.write(`demo-result:${userId}:${result.sessionId}`, result);
      return progress;
    }
    // A failed attempt is kept only to show its results page; it never becomes progress.
    if (isLessonResult(result) && !isPassedResult(result)) {
      this.storage.write(`failed-result:${userId}:${result.sessionId}`, result);
      return progress;
    }
    if (!applyResult(progress, result)) return progress;
    this.storage.write(`progress:${userId}`, progress);
    return progress;
  }

  /** Adds results from another device or the guest profile; duplicates are ignored. */
  mergeResults(userId: string, results: readonly LessonResult[]) {
    if (!this.canReadProgress(userId)) return emptyProgress();
    const progress = this.getProgress(userId);
    const sorted = results.filter(isLessonResult).filter((result) => !isDemoResult(result) && isPassedResult(result)).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    let changed = false;
    for (const result of sorted) changed = applyResult(progress, result) || changed;
    if (changed) {
      progress.sessions.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
      this.storage.write(`progress:${userId}`, progress);
    }
    return progress;
  }
}

/** Shared progress store of the app. */
export const progressService: ProgressStore = new ProgressService(storage, canReadProgress);

/** Consecutive days (ending today or yesterday) with at least one finished lesson. */
export function streakDays(sessions: readonly LessonResult[], now = new Date()) {
  const days = new Set(sessions.filter(isPassedResult).map((session) => new Date(session.completedAt).toDateString()));
  const cursor = new Date(now);
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
