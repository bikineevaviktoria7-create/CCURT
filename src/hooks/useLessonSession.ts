import { useCallback, useEffect, useReducer, useState } from "react";
import { calculateLessonResult } from "../services/progressService.ts";
import type { GestureAttempt, LessonSessionState } from "../types/progress";
import type { Lesson } from "../types/lesson";

export type SessionAction =
  | { type: "NEXT_THEORY"; total: number }
  | { type: "START_PRACTICE" }
  | { type: "ACCEPT"; attempt: GestureAttempt }
  | { type: "ADVANCE"; total: number };

export function initialSession(now: number): LessonSessionState {
  return {
    phase: "learn",
    currentGestureIndex: 0,
    attempts: [],
    startedAt: now,
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
          };
  }
}

export function useLessonSession(lesson: Lesson) {
  const [state, dispatch] = useReducer(
    lessonSessionReducer,
    Date.now(),
    initialSession,
  );
  const [sessionId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (state.phase !== "transition") return;
    const timer = window.setTimeout(
      () =>
        dispatch({
          type: "ADVANCE",
          total: lesson.gestures.length,
        }),
      950,
    );
    return () => window.clearTimeout(timer);
  }, [state.phase, lesson.gestures.length]);
  const accept = useCallback(
    (attempt: GestureAttempt) => dispatch({ type: "ACCEPT", attempt }),
    [],
  );
  return {
    state,
    accept,
    nextTheory: () =>
      dispatch({
        type: "NEXT_THEORY",
        total: (lesson.theoryGestures ?? lesson.gestures).length,
      }),
    startPractice: () => dispatch({ type: "START_PRACTICE" }),
    result: () =>
      calculateLessonResult(
        lesson.id,
        state.attempts,
        state.startedAt,
        sessionId,
      ),
  };
}
