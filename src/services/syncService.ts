import { MOCK_AUTH_ENABLED } from "../app/constants";
import { canReadProgress } from "./accessService";
import { isRecord, storage } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { isDemoResult, isLessonResult, isPassedResult, progressService } from "./progressService";
import type { ProgressStore } from "./progressService";
import type { LearningProgress, LessonResult } from "../types/progress";

// Прогресс сначала локальный: экраны сразу читают localStorage, а результаты
// копируются в Supabase в фоне. Неудачные отправки ждут в очереди.

interface Pending {
  userId: string;
  result: LessonResult;
}

const QUEUE = "pending-sync";

/** Хранилище «ключ — значение», в котором лежит очередь отправки. */
type SyncStorage = Pick<typeof storage, "read" | "write">;

/** Всё, с чем работает сервис синхронизации; передаётся снаружи, чтобы в тестах подставлять заглушки. */
export interface SyncDependencies {
  supabase: typeof supabase;
  storage: SyncStorage;
  progressService: ProgressStore;
  canReadProgress: (userId: string) => boolean;
  mockAuthEnabled: boolean;
}

/** Фоновая отправка результатов уроков с очередью повторов. */
export interface SyncApi {
  /** True, если результаты копируются в Supabase (простое значение, не метод). */
  readonly enabled: boolean;
  push(userId: string, result: LessonResult): void;
  flush(): Promise<void>;
  pull(userId: string): Promise<LearningProgress>;
}

function warnRetryLater(detail: unknown) {
  console.warn("[SignStep] результат будет отправлен позже", detail);
}

/** Фоновая отправка результатов уроков в Supabase с очередью повторов. */
export class SyncService implements SyncApi {
  readonly enabled: boolean;
  private supabase: typeof supabase;
  private storage: SyncStorage;
  private progressService: ProgressStore;
  private canReadProgress: (userId: string) => boolean;
  private mockAuthEnabled: boolean;
  private flushing: Promise<void> | null;

  constructor(dependencies: SyncDependencies) {
    this.supabase = dependencies.supabase;
    this.storage = dependencies.storage;
    this.progressService = dependencies.progressService;
    this.canReadProgress = dependencies.canReadProgress;
    this.mockAuthEnabled = dependencies.mockAuthEnabled;
    this.enabled = !this.mockAuthEnabled && this.supabase !== null;
    this.flushing = null;
  }

  /** Ставит реальный результат в очередь на отправку и начинает отправку. */
  push(userId: string, result: LessonResult) {
    if (this.mockAuthEnabled || !this.canReadProgress(userId) || !this.supabase || !isLessonResult(result) || isDemoResult(result) || !isPassedResult(result)) return;
    this.storage.write(QUEUE, [...this.queueWithout(userId, result.sessionId), { userId, result }]);
    void this.flush();
  }

  /** По одному отправляет результаты вошедшего пользователя из очереди; одновременно идёт только один проход. */
  flush() {
    const client = this.supabase;
    if (this.mockAuthEnabled || !client) return Promise.resolve();
    this.flushing ??= Promise.resolve().then(async () => {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        const sessionUserId = data.session?.user.id;
        if (!sessionUserId) return;
        while (true) {
          const item = this.queue().find((pending) => pending.userId === sessionUserId);
          if (!item || !this.canReadProgress(item.userId)) break;
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
            warnRetryLater(error.message);
            break;
          }
          this.storage.write(QUEUE, this.queueWithout(item.userId, item.result.sessionId));
        }
      } catch (error) {
        warnRetryLater(error);
      } finally {
        this.flushing = null;
      }
    });
    return this.flushing;
  }

  /** Загружает результаты, сохранённые на других устройствах, и объединяет их с локальным прогрессом. */
  async pull(userId: string) {
    const client = this.supabase;
    if (this.mockAuthEnabled || !this.canReadProgress(userId) || !client) return this.progressService.getProgress(userId);
    const { data, error } = await client
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
    }) : null).filter(isLessonResult).filter((result) => !isDemoResult(result) && isPassedResult(result));
    const merged = this.progressService.mergeResults(userId, results);
    // Всё, что записано офлайн или гостем до входа, отправляется сейчас.
    const remote = new Set(results.map((result) => result.sessionId));
    for (const session of merged.sessions)
      if (!remote.has(session.sessionId)) this.push(userId, session);
    return merged;
  }

  private queue(): Pending[] {
    const value = this.storage.read(QUEUE);
    return Array.isArray(value)
      ? value.filter(
          (item): item is Pending =>
            isRecord(item) && Object.hasOwn(item, "userId") && Object.hasOwn(item, "result") &&
            typeof item.userId === "string" && item.userId.length > 0 &&
            isLessonResult(item.result) && !isDemoResult(item.result) && isPassedResult(item.result),
        )
      : [];
  }

  private queueWithout(userId: string, sessionId: string): Pending[] {
    return this.queue().filter((item) => item.userId !== userId || item.result.sessionId !== sessionId);
  }
}

/** Общий сервис синхронизации приложения. */
export const syncService: SyncApi = new SyncService({
  supabase,
  storage,
  progressService,
  canReadProgress,
  mockAuthEnabled: MOCK_AUTH_ENABLED,
});

if (typeof window !== "undefined")
  window.addEventListener("online", () => void syncService.flush());
