import type { GestureAttempt, LessonSessionState } from "../types/progress";

export type SessionAction =
  | { type: "NEXT_THEORY"; total: number }
  | { type: "START_PRACTICE"; now: number }
  | { type: "ACCEPT"; attempt: GestureAttempt }
  | { type: "ADVANCE"; total: number; now: number };

export function initialSession(now: number): LessonSessionState {
  return {
    phase: "learn",
    currentGestureIndex: 0,
    attempts: [],
    startedAt: now,
    currentGestureStartedAt: now,
  };
}
export function lessonSessionReducer(
  state: LessonSessionState,
  action: SessionAction,
): LessonSessionState {
  switch (action.type) {
    case "NEXT_THEORY":
      if (state.phase !== "learn") return state;
      return state.currentGestureIndex + 1 === action.total
        ? { ...state, phase: "ready", currentGestureIndex: 0 }
        : { ...state, currentGestureIndex: state.currentGestureIndex + 1 };
    case "START_PRACTICE":
      return state.phase === "ready"
        ? {
            ...state,
            phase: "practice",
            currentGestureIndex: 0,
            currentGestureStartedAt: action.now,
          }
        : state;
    case "ACCEPT":
      return state.phase === "practice"
        ? {
            ...state,
            phase: "transition",
            attempts: [...state.attempts, action.attempt],
          }
        : state;
    case "ADVANCE":
      if (state.phase !== "transition") return state;
      return state.currentGestureIndex + 1 === action.total
        ? { ...state, phase: "completed" }
        : {
            ...state,
            phase: "practice",
            currentGestureIndex: state.currentGestureIndex + 1,
            currentGestureStartedAt: action.now,
          };
  }
}
