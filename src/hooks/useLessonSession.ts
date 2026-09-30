import { useCallback, useEffect, useReducer, useState } from "react";
import { calculateLessonResult } from "../services/progressService.ts";
import type { Lesson } from "../types/lesson";
import type { GestureAttempt, LessonSessionState } from "../types/progress";

/** Действия `lessonSessionReducer`; `total` — число жестов текущего этапа. */
export type LessonSessionAction =
  | { type: "NEXT_THEORY"; total: number }
  | { type: "START_PRACTICE" }
  | { type: "COUNTDOWN_TICK" }
  | { type: "ACCEPT"; attempt: GestureAttempt }
  | { type: "ADVANCE"; total: number };

/** Состояние в начале урока: первая карточка теории, попыток нет. */
export function initialSession(now: number): LessonSessionState {
  return {
    phase: "learn",
    currentGestureIndex: 0,
    attempts: [],
    countdown: 0,
    startedAt: now,
  };
}

/** Порядок урока: вся теория → готовность → вся практика → завершение; действия не по порядку игнорируются. */
export function lessonSessionReducer(
  state: LessonSessionState,
  action: LessonSessionAction,
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
            phase: "prepare",
            countdown: 3,
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
            phase: state.attempts.at(-1)?.success ? "prepare" : "practice",
            countdown: state.attempts.at(-1)?.success ? 3 : 0,
            currentGestureIndex: state.currentGestureIndex + 1,
          };
    case "COUNTDOWN_TICK":
      if (state.phase !== "prepare") return state;
      return state.countdown > 1
        ? { ...state, countdown: state.countdown - 1 }
        : { ...state, phase: "practice", countdown: 0 };
  }
}

/** Сессия урока в React: переходы по таймеру, обратный отсчёт и итоговый результат. */
export function useLessonSession(lesson: Lesson, paused = false) {
  const [state, dispatch] = useReducer(
    lessonSessionReducer,
    Date.now(),
    initialSession,
  );
  const [cameraReady, setCameraReady] = useState(false);
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
  useEffect(() => {
    if (state.phase !== "prepare" || paused || !cameraReady) return;
    // 950 мс успеха + три такта по 650 мс = 2,9 с, чтобы сменить положение руки.
    const timer = window.setTimeout(() => dispatch({ type: "COUNTDOWN_TICK" }), 650);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.countdown, paused, cameraReady]);
  const accept = useCallback(
    (attempt: GestureAttempt) => dispatch({ type: "ACCEPT", attempt }),
    [],
  );
  return {
    state,
    accept,
    setCameraReady,
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
