import type { GestureErrorCode, VisionMode } from "./vision";
import type { Stars } from "./lesson";

export type LessonPhase =
  "learn" | "ready" | "practice" | "prepare" | "transition" | "completed";

export interface GestureAttempt {
  /** Absent only in legacy results, whose source was not recorded. */
  mode?: VisionMode;
  gestureId: string;
  success: boolean;
  skipped: boolean;
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
  /** 0 means the lesson was not passed: such a result is shown but never saved. */
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
