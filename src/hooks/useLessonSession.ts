import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialSession, lessonSessionReducer } from "../lib/lessonSession";
import { calculateLessonResult } from "../services/progressService";
import type { GestureAttempt } from "../types/progress";
import type { Lesson } from "../types/lesson";

export function useLessonSession(lesson: Lesson) {
  const [state, dispatch] = useReducer(
    lessonSessionReducer,
    Date.now(),
    initialSession,
  );
  const sessionId = useRef(crypto.randomUUID());
  useEffect(() => {
    if (state.phase !== "transition") return;
    const timer = window.setTimeout(
      () =>
        dispatch({
          type: "ADVANCE",
          total: lesson.gestures.length,
          now: Date.now(),
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
      dispatch({ type: "NEXT_THEORY", total: lesson.gestures.length }),
    startPractice: () => dispatch({ type: "START_PRACTICE", now: Date.now() }),
    result: () =>
      calculateLessonResult(
        lesson.id,
        state.attempts,
        state.startedAt,
        sessionId.current,
      ),
  };
}
