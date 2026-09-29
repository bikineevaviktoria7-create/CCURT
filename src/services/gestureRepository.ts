import { supabase } from "../lib/supabase";
import { localDb } from "../lib/localDb";
import { FEATURE_VERSION } from "../vision/features";
import type { GestureSample } from "../vision/types";
import type { GestureErrorCode } from "../types/vision";

// One place that knows where gesture samples and content (description, photo,
// hints) come from. Priority: Supabase → saved sample data (IndexedDB) → the
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

// Keep legacy keys so existing lesson samples remain available.
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
};
