import { MOCK_AUTH_ENABLED } from "../app/constants";
import { canReadProgress } from "./accessService";
import { isRecord, storage } from "../lib/storage";
import { supabase } from "../lib/supabase";
import type { LessonResult } from "../types/progress";
import { isDemoResult, isLessonResult, progressService } from "./progressService";

// Progress is local-first: screens read localStorage instantly, and results are
// copied to Supabase in the background. Failed uploads wait in a queue.

interface Pending {
  userId: string;
  result: LessonResult;
}

const QUEUE = "pending-sync";

function queue(): Pending[] {
  const value = storage.read(QUEUE);
  return Array.isArray(value)
    ? value.filter(
        (item): item is Pending =>
          isRecord(item) && Object.hasOwn(item, "userId") && Object.hasOwn(item, "result") &&
          typeof item.userId === "string" && item.userId.length > 0 &&
          isLessonResult(item.result) && !isDemoResult(item.result),
      )
    : [];
}

let flushing: Promise<void> | null = null;

export const syncService = {
  enabled: !MOCK_AUTH_ENABLED && supabase !== null,

  push(userId: string, result: LessonResult) {
    if (MOCK_AUTH_ENABLED || !canReadProgress(userId) || !supabase || !isLessonResult(result) || isDemoResult(result)) return;
    storage.write(QUEUE, [...queue().filter((item) => item.userId !== userId || item.result.sessionId !== result.sessionId), { userId, result }]);
    void this.flush();
  },

  flush() {
    const client = supabase;
    if (MOCK_AUTH_ENABLED || !client) return Promise.resolve();
    flushing ??= Promise.resolve().then(async () => {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        const currentUser = data.session?.user.id;
        if (!currentUser) return;
        while (true) {
          const item = queue().find((pending) => pending.userId === currentUser);
          if (!item || !canReadProgress(item.userId)) break;
          const { error } = await client.from("lesson_results").upsert(
            {
              id: item.result.sessionId,
              user_id: item.userId,
              lesson_id: item.result.lessonId,
              score: item.result.score,
              accuracy: item.result.accuracy,
              stars: item.result.stars,
              duration_ms: item.result.durationMs,
              attempts: item.result.attempts,
              completed_at: item.result.completedAt,
            },
            { onConflict: "id", ignoreDuplicates: true },
          );
          if (error) {
            console.warn("[SignStep] результат будет отправлен позже", error.message);
            break;
          }
          storage.write(QUEUE, queue().filter((pending) => pending.userId !== item.userId || pending.result.sessionId !== item.result.sessionId));
        }
      } catch (error) {
        console.warn("[SignStep] результат будет отправлен позже", error);
      } finally {
        flushing = null;
      }
    });
    return flushing;
  },

  /** Downloads results saved from other devices and merges them into local progress. */
  async pull(userId: string) {
    if (MOCK_AUTH_ENABLED || !canReadProgress(userId) || !supabase) return progressService.getProgress(userId);
    const { data, error } = await supabase
      .from("lesson_results")
      .select("id, lesson_id, score, accuracy, stars, duration_ms, attempts, completed_at")
      .eq("user_id", userId)
      .order("completed_at");
    if (error) throw error;
    const results = (data ?? []).map((row: unknown) => isRecord(row) ? ({
      sessionId: row.id,
      lessonId: row.lesson_id,
      score: row.score,
      accuracy: row.accuracy,
      stars: row.stars,
      durationMs: row.duration_ms,
      attempts: row.attempts,
      completedAt: row.completed_at,
    }) : null).filter(isLessonResult).filter((result) => !isDemoResult(result));
    const merged = progressService.mergeResults(userId, results);
    // Anything recorded offline or as a guest before signing in goes up now.
    const remote = new Set(results.map((result) => result.sessionId));
    for (const session of merged.sessions)
      if (!remote.has(session.sessionId)) this.push(userId, session);
    return merged;
  },
};

if (typeof window !== "undefined")
  window.addEventListener("online", () => void syncService.flush());
