import type { GestureErrorCode } from "./vision";
import type { Stars } from "./lesson";

export type LessonPhase =
  "learn" | "ready" | "practice" | "transition" | "completed";

export interface GestureAttempt {
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
  startedAt: number;
  currentGestureStartedAt: number;
}

export interface LessonResult {
  sessionId: string;
  lessonId: string;
  completedAt: string;
  score: number;
  accuracy: number;
  stars: Exclude<Stars, 0>;
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
