import type { GestureErrorCode, VisionMode } from "./vision";
import type { Stars } from "./lesson";

export type LessonPhase =
  "learn" | "ready" | "practice" | "prepare" | "transition" | "completed";

export interface GestureAttempt {
  /** Отсутствует только в старых результатах, у которых источник не записывался. */
  mode?: VisionMode;
  gestureId: string;
  success: boolean;
  skipped: boolean;
  /**
   * `false` — жест без автоматической оценки (нет эталонов): его изучают,
   * но не оценивают. Отсутствие поля — оцениваемый жест (все старые результаты).
   */
  assessed?: false;
  confidence?: number;
  errorCodes: GestureErrorCode[];
  durationMs: number;
}

export interface LessonSessionState {
  phase: LessonPhase;
  currentGestureIndex: number;
  attempts: GestureAttempt[];
  countdown: number;
  startedAt: number;
}

export interface LessonResult {
  mode?: VisionMode;
  sessionId: string;
  lessonId: string;
  completedAt: string;
  score: number;
  accuracy: number;
  /** 0 — урок не пройден: такой результат показывается, но не сохраняется. */
  stars: Stars;
  durationMs: number;
  attempts: GestureAttempt[];
}

export interface LessonProgress {
  lessonId: string;
  stars: Stars;
  bestScore: number;
  bestAccuracy: number;
  completedAt: string;
}

export interface LearningProgress {
  lessons: Record<string, LessonProgress>;
  sessions: LessonResult[];
  lastLessonId: string | null;
}
