import { isRecord, storage } from "../lib/storage.ts";
import type {
  GestureAttempt,
  LearningProgress,
  LessonResult,
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
};
export const emptyProgress = (): LearningProgress => ({
  lessons: {},
  sessions: [],
  lastLessonId: null,
});

export function calculateLessonResult(
  lessonId: string,
  attempts: GestureAttempt[],
  startedAt: number,
  sessionId: string,
): LessonResult {
  const points = attempts.map((attempt) =>
    attempt.success ? Math.max(60, 100 - attempt.errorCodes.length * 8) : 0,
  );
  const accuracy = points.length
    ? Math.round(points.reduce((sum, value) => sum + value, 0) / points.length)
    : 0;
  return {
    sessionId,
    lessonId,
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
  return lesson.id === next?.id ? "current" : "locked";
}

export const progressService = {
  getProgress(userId: string): LearningProgress {
    const value = storage.read(`progress:${userId}`);
    if (
      !isRecord(value) ||
      !isRecord(value.lessons) ||
      !Array.isArray(value.sessions)
    )
      return emptyProgress();
    // Validate persisted collections before letting them reach screens.
    const lessons: LearningProgress["lessons"] = {};
    for (const [id, item] of Object.entries(value.lessons)) {
      if (
        isRecord(item) &&
        typeof item.lessonId === "string" &&
        typeof item.bestScore === "number" &&
        typeof item.bestAccuracy === "number" &&
        typeof item.completedAt === "string" &&
        [0, 1, 2, 3].includes(Number(item.stars))
      ) {
        lessons[id] = item as unknown as LearningProgress["lessons"][string];
      }
    }
    const sessions = value.sessions.filter(
      (item): item is LessonResult =>
        isRecord(item) &&
        typeof item.sessionId === "string" &&
        typeof item.lessonId === "string" &&
        typeof item.accuracy === "number" &&
        typeof item.score === "number" &&
        typeof item.durationMs === "number" &&
        [1, 2, 3].includes(Number(item.stars)) &&
        Array.isArray(item.attempts) &&
        item.attempts.every(
          (attempt: unknown) =>
            isRecord(attempt) &&
            typeof attempt.success === "boolean" &&
            Array.isArray(attempt.errorCodes) &&
            attempt.errorCodes.every(
              (code: unknown) =>
                typeof code === "string" && code in errorLabels,
            ),
        ),
    );
    return {
      lessons,
      sessions,
      lastLessonId:
        typeof value.lastLessonId === "string" ? value.lastLessonId : null,
    };
  },
  completeLesson(userId: string, result: LessonResult) {
    const progress = this.getProgress(userId);
    if (
      progress.sessions.some(
        (session) => session.sessionId === result.sessionId,
      )
    )
      return progress;
    const previous = progress.lessons[result.lessonId];
    progress.lessons[result.lessonId] = {
      lessonId: result.lessonId,
      completedAt: result.completedAt,
      stars: Math.max(previous?.stars ?? 0, result.stars) as 1 | 2 | 3,
      bestScore: Math.max(previous?.bestScore ?? 0, result.score),
      bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, result.accuracy),
    };
    progress.sessions.push(result);
    progress.lastLessonId = result.lessonId;
    storage.write(`progress:${userId}`, progress);
    return progress;
  },
};
