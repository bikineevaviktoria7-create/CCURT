import { supabase } from "../lib/supabase";
import { localDb } from "../lib/localDb";
import { isStaticSample } from "../vision/staticMatcher";
import type { GestureSample } from "../vision/types";
import type { ReferenceMedia } from "../types/lesson";
import type { GestureErrorCode } from "../types/vision";

// Единственное место, которое знает, откуда берутся эталоны и контент жестов (описание,
// фото, подсказки). Приоритет: Supabase → сохранённые эталоны (IndexedDB) → резервная
// копия public/data/samples.json. Приложение работает, даже если какого-то источника нет.

/** Описание, фото и подсказки одного жеста. */
export interface GestureContent {
  id: string;
  description?: string;
  imageUrl?: string;
  referenceMedia?: ReferenceMedia;
  hints?: Partial<Record<GestureErrorCode, string>>;
}

/** Формат public/data/samples.json. */
export interface GestureBundle {
  version: number;
  exportedAt: string | null;
  tolerance?: number;
  gestures: GestureContent[];
  samples: GestureSample[];
}

// Старые ключи сохранены, чтобы уже записанные эталоны оставались доступны.
const GESTURE_BUNDLE_VERSION = 1;
const LOCAL_SAMPLES = "admin:samples";
const LOCAL_CONTENT = "admin:content";

interface SampleRow {
  id: string;
  gesture_id: string;
  features: number[] | null;
  sequence: number[][] | null;
  duration_ms: number | null;
  landmarks: unknown;
  handedness: string | null;
  feature_version: number;
  created_at: string;
}

interface GestureRow {
  id: string;
  description: string | null;
  reference_image_url: string | null;
  hints: Partial<Record<GestureErrorCode, string>> | null;
}

const fromRow = (row: SampleRow): GestureSample => ({
  id: row.id,
  gestureId: row.gesture_id,
  features: row.features ?? undefined,
  sequence: row.sequence ?? undefined,
  durationMs: row.duration_ms ?? undefined,
  landmarks: row.landmarks,
  handedness: row.handedness === "left" ? "left" : row.handedness === "right" ? "right" : undefined,
  featureVersion: row.feature_version,
  createdAt: row.created_at,
});

async function loadBundle(): Promise<GestureBundle> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/samples.json`, { cache: "no-cache" });
    if (!response.ok || !response.headers.get("content-type")?.includes("json"))
      throw new Error("no bundle");
    const bundle = (await response.json()) as Partial<GestureBundle>;
    return {
      version: GESTURE_BUNDLE_VERSION,
      exportedAt: bundle.exportedAt ?? null,
      tolerance: bundle.tolerance,
      gestures: Array.isArray(bundle.gestures) ? bundle.gestures : [],
      samples: Array.isArray(bundle.samples) ? bundle.samples : [],
    };
  } catch {
    return { version: GESTURE_BUNDLE_VERSION, exportedAt: null, gestures: [], samples: [] };
  }
}

function mergeContent(...sources: GestureContent[][]) {
  const result: Record<string, GestureContent> = {};
  // У следующих источников приоритет ниже: они заполняют только пустые поля.
  for (const source of sources)
    for (const item of source) {
      const current = result[item.id] ?? { id: item.id };
      result[item.id] = {
        id: item.id,
        description: current.description || item.description || undefined,
        imageUrl: current.imageUrl || item.imageUrl || undefined,
        referenceMedia: current.referenceMedia ?? item.referenceMedia,
        hints: { ...(item.hints ?? {}), ...(current.hints ?? {}) },
      };
    }
  return result;
}

/** Всё, что загружено из всех источников эталонов. */
export interface GestureData {
  samples: GestureSample[];
  content: Record<string, GestureContent>;
  tolerance?: number;
}

/** Кешированные эталоны и контент жестов с уведомлениями об изменениях. */
export interface GestureStore {
  load(): Promise<GestureData>;
  /** Сбрасывает кеш и оповещает подписчиков (стрелочное поле: можно передавать как колбэк). */
  invalidate: () => void;
  /** Добавляет подписчика на изменения и возвращает функцию отписки (стрелочное поле). */
  onChange: (listener: () => void) => () => void;
}

/** Эталоны и контент жестов из всех источников с кешем и уведомлениями об изменениях. */
export class GestureRepository implements GestureStore {
  private supabase: typeof supabase;
  private localDb: typeof localDb;
  private cache: Promise<GestureData> | null;
  private listeners: Set<() => void>;

  constructor(client: typeof supabase, database: typeof localDb) {
    this.supabase = client;
    this.localDb = database;
    this.cache = null;
    this.listeners = new Set<() => void>();
  }

  load() {
    this.cache ??= this.loadAll();
    return this.cache;
  }

  invalidate = () => {
    this.cache = null;
    this.listeners.forEach((listener) => listener());
  };

  onChange = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private async loadRemoteSamples(): Promise<GestureSample[]> {
    const client = this.supabase;
    if (!client) return [];
    const rows: SampleRow[] = [];
    // Читаем таблицу страницами (PostgREST отдаёт не больше 1000 строк за запрос).
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client
        .from("gesture_samples")
        .select("id, gesture_id, features, sequence, duration_ms, handedness, feature_version, created_at")
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as SampleRow[]));
      if (!data || data.length < 1000) break;
    }
    return rows.map(fromRow);
  }

  private async loadRemoteContent(): Promise<GestureContent[]> {
    const client = this.supabase;
    if (!client) return [];
    const { data, error } = await client
      .from("gestures")
      .select("id, description, reference_image_url, hints");
    if (error) throw error;
    return ((data ?? []) as GestureRow[]).map((row) => ({
      id: row.id,
      description: row.description ?? undefined,
      imageUrl: row.reference_image_url ?? undefined,
      hints: row.hints ?? undefined,
    }));
  }

  private async localSamples() {
    return (await this.localDb.get<GestureSample[]>(LOCAL_SAMPLES)) ?? [];
  }

  private async localContent() {
    return (await this.localDb.get<Record<string, GestureContent>>(LOCAL_CONTENT)) ?? {};
  }

  private async loadAll(): Promise<GestureData> {
    const [remoteSamples, remoteContent, local, localInfo, bundle] = await Promise.all([
      this.loadRemoteSamples().catch((error: unknown) => {
        console.warn("[SignStep] эталоны из Supabase недоступны", error);
        return [] as GestureSample[];
      }),
      this.loadRemoteContent().catch(() => [] as GestureContent[]),
      this.localSamples(),
      this.localContent(),
      loadBundle(),
    ]);
    const byId = new Map<string, GestureSample>();
    // Сначала сервер, затем локальные несинхронизированные записи, затем резервная копия —
    // она используется только для жестов, у которых нигде нет подходящих статических эталонов.
    for (const sample of [...remoteSamples, ...local]) byId.set(sample.id, sample);
    const covered = new Set([...byId.values()].filter(isStaticSample).map((sample) => sample.gestureId));
    for (const sample of bundle.samples)
      if (!covered.has(sample.gestureId)) byId.set(sample.id, sample);
    const samples = [...byId.values()].filter(isStaticSample);
    return {
      samples,
      content: mergeContent(remoteContent, Object.values(localInfo), bundle.gestures),
      tolerance: bundle.tolerance,
    };
  }
}

/** Общий репозиторий жестов приложения. */
export const gestureRepository: GestureStore = new GestureRepository(supabase, localDb);
