import { requireAdmin } from "./accessService";
import { supabase } from "../lib/supabase";
import { localDb } from "../lib/localDb";
import { FEATURE_VERSION } from "../vision/features";
import { GESTURE_BUNDLE_VERSION, validateGestureBundle } from "./gestureValidation";
import type { GestureSample, Hand } from "../vision/types";
import type { GestureErrorCode } from "../types/vision";

// One place that knows where gesture samples and content (description, photo,
// hints) come from. Priority: Supabase → local admin data (IndexedDB) → the
// bundled backup public/data/samples.json. The app keeps working if any is missing.

export interface GestureContent {
  id: string;
  description?: string;
  imageUrl?: string;
  hints?: Partial<Record<GestureErrorCode, string>>;
}

export interface GestureBundle {
  version: number;
  exportedAt: string | null;
  tolerance?: number;
  gestures: GestureContent[];
  samples: GestureSample[];
}

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

async function loadRemoteSamples(): Promise<GestureSample[]> {
  if (!supabase) return [];
  const rows: SampleRow[] = [];
  // Page through the table (PostgREST returns at most 1000 rows per request).
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("gesture_samples")
      .select("id, gesture_id, features, sequence, duration_ms, handedness, feature_version, created_at")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as SampleRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows.map(fromRow);
}

async function loadRemoteContent(): Promise<GestureContent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
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

const localSamples = async () => (await localDb.get<GestureSample[]>(LOCAL_SAMPLES)) ?? [];
const localContent = async () =>
  (await localDb.get<Record<string, GestureContent>>(LOCAL_CONTENT)) ?? {};

function mergeContent(...sources: GestureContent[][]) {
  const result: Record<string, GestureContent> = {};
  // Later sources have lower priority: fill only missing fields.
  for (const source of sources)
    for (const item of source) {
      const current = result[item.id] ?? { id: item.id };
      result[item.id] = {
        id: item.id,
        description: current.description || item.description || undefined,
        imageUrl: current.imageUrl || item.imageUrl || undefined,
        hints: { ...(item.hints ?? {}), ...(current.hints ?? {}) },
      };
    }
  return result;
}

let cache: Promise<{ samples: GestureSample[]; content: Record<string, GestureContent>; tolerance?: number }> | null = null;

async function loadAll() {
  const [remoteSamples, remoteContent, local, localInfo, bundle] = await Promise.all([
    loadRemoteSamples().catch((error: unknown) => {
      console.warn("[SignStep] эталоны из Supabase недоступны", error);
      return [] as GestureSample[];
    }),
    loadRemoteContent().catch(() => [] as GestureContent[]),
    localSamples(),
    localContent(),
    loadBundle(),
  ]);
  const byId = new Map<string, GestureSample>();
  // Remote first, then local unsynced recordings, then the bundled backup —
  // the backup is only used for gestures that have no samples anywhere else.
  for (const sample of [...remoteSamples, ...local]) byId.set(sample.id, sample);
  const covered = new Set([...byId.values()].map((sample) => sample.gestureId));
  for (const sample of bundle.samples)
    if (!covered.has(sample.gestureId)) byId.set(sample.id, sample);
  const samples = [...byId.values()].filter(
    (sample) => sample.featureVersion === FEATURE_VERSION,
  );
  return {
    samples,
    content: mergeContent(remoteContent, Object.values(localInfo), bundle.gestures),
    tolerance: bundle.tolerance,
  };
}

const listeners = new Set<() => void>();

export const gestureRepository = {
  load() {
    cache ??= loadAll();
    return cache;
  },
  invalidate() {
    cache = null;
    listeners.forEach((listener) => listener());
  },
  onChange(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Where admin changes are written: the database when available, else this browser. */
  target(isAdmin: boolean): "remote" | "local" {
    return supabase && isAdmin ? "remote" : "local";
  },

  async addSamples(
    target: "remote" | "local",
    samples: Omit<GestureSample, "id" | "featureVersion">[],
    authorId?: string,
  ) {
    requireAdmin();
    const complete: GestureSample[] = samples.map((sample) => ({
      ...sample,
      id: crypto.randomUUID(),
      featureVersion: FEATURE_VERSION,
      createdAt: new Date().toISOString(),
    }));
    if (target === "remote" && supabase) {
      const { error } = await supabase.from("gesture_samples").insert(
        complete.map((sample) => ({
          id: sample.id,
          gesture_id: sample.gestureId,
          author_id: authorId ?? null,
          features: sample.features ?? null,
          sequence: sample.sequence ?? null,
          duration_ms: sample.durationMs ? Math.round(sample.durationMs) : null,
          landmarks: sample.landmarks ?? [],
          handedness: sample.handedness ?? null,
          feature_version: sample.featureVersion,
        })),
      );
      if (error) throw new Error(`Не удалось сохранить эталоны: ${error.message}`);
    } else {
      await localDb.set(LOCAL_SAMPLES, [...(await localSamples()), ...complete]);
    }
    this.invalidate();
    return complete.length;
  },

  async deleteSamples(target: "remote" | "local", gestureId: string) {
    requireAdmin();
    if (target === "remote" && supabase) {
      const { error } = await supabase.from("gesture_samples").delete().eq("gesture_id", gestureId);
      if (error) throw new Error(`Не удалось удалить эталоны: ${error.message}`);
    }
    await localDb.set(
      LOCAL_SAMPLES,
      (await localSamples()).filter((sample) => sample.gestureId !== gestureId),
    );
    this.invalidate();
  },

  async saveContent(target: "remote" | "local", content: GestureContent) {
    requireAdmin();
    if (target === "remote" && supabase) {
      const { error } = await supabase
        .from("gestures")
        .update({
          description: content.description ?? null,
          reference_image_url: content.imageUrl ?? null,
          ...(content.hints ? { hints: content.hints } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", content.id);
      if (error) throw new Error(`Не удалось сохранить описание: ${error.message}`);
    } else {
      const all = await localContent();
      all[content.id] = { ...all[content.id], ...content };
      await localDb.set(LOCAL_CONTENT, all);
    }
    this.invalidate();
  },

  /** Uploads a gesture photo and returns its public URL (or a data URL locally). */
  async uploadImage(target: "remote" | "local", gestureId: string, blob: Blob) {
    requireAdmin();
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    if (target === "remote" && supabase) {
      const path = `gestures/${gestureId}.${extension}`;
      const { error } = await supabase.storage
        .from("gesture-media")
        .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" });
      if (error) throw new Error(`Не удалось загрузить фото: ${error.message}`);
      const { data } = supabase.storage.from("gesture-media").getPublicUrl(path);
      return `${data.publicUrl}?v=${Date.now()}`;
    }
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Не удалось прочитать фото"));
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Everything needed to restore recognition: goes to public/data/samples.json.
   * Photos are left out on purpose: the file is public after deploy, and
   * recognition needs only hand coordinates.
   */
  async exportBundle(tolerance?: number): Promise<GestureBundle> {
    requireAdmin();
    const { samples, content } = await loadAll();
    return {
      version: GESTURE_BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      ...(tolerance ? { tolerance } : {}),
      gestures: Object.values(content).map((item) => ({ ...item, imageUrl: undefined })),
      samples: samples.map((sample) => ({ ...sample, landmarks: sample.landmarks ?? undefined })),
    };
  },

  async importBundle(target: "remote" | "local", bundle: unknown) {
    requireAdmin();
    validateGestureBundle(bundle);
    const samples = bundle.samples;
    await this.addSamples(
      target,
      samples.map((sample) => ({
        gestureId: sample.gestureId,
        features: sample.features,
        sequence: sample.sequence,
        durationMs: sample.durationMs,
        landmarks: sample.landmarks,
        handedness: sample.handedness,
      })),
    );
    for (const item of bundle.gestures) {
      if (!item.description && !item.imageUrl) continue;
      let imageUrl = item.imageUrl;
      if (target === "remote" && imageUrl?.startsWith("data:")) {
        const blob = await (await fetch(imageUrl)).blob();
        imageUrl = await this.uploadImage(target, item.id, blob);
      }
      await this.saveContent(target, { ...item, imageUrl });
    }
    return samples.length;
  },
};

export type SampleInput = Omit<GestureSample, "id" | "featureVersion"> & { handedness?: Hand };
