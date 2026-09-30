import { useEffect, useState } from "react";
import { allGestures } from "../data/lessons";
import { buildStaticModels, type StaticGestureModel } from "../vision/staticMatcher";
import { gestureRepository, type GestureContent } from "./gestureRepository";
import { settingsService } from "./settingsService";
import type { LoadStatus } from "../types/loading";

/** Gesture models built from the samples, plus labels and content for the UI. */
export interface GestureLibrary {
  staticModels: ReadonlyMap<string, StaticGestureModel>;
  labels: Readonly<Record<string, string>>;
  content: Readonly<Record<string, GestureContent>>;
  sampleCounts: Readonly<Record<string, number>>;
  totalSamples: number;
  bundleTolerance?: number;
}

let cache: Promise<GestureLibrary> | null = null;
gestureRepository.onChange(() => {
  cache = null;
});

/** Loads samples once and builds the models; the cache resets when the samples change. */
export function loadGestureLibrary() {
  cache ??= gestureRepository.load().then(({ samples, content, tolerance }) => {
    const staticModels = buildStaticModels(samples);
    const sampleCounts: Record<string, number> = {};
    for (const [id, model] of staticModels) sampleCounts[id] = model.samples.length;
    return {
      staticModels,
      labels: Object.fromEntries(allGestures.map((gesture) => [gesture.id, gesture.label])),
      content,
      sampleCounts,
      totalSamples: samples.length,
      bundleTolerance: tolerance,
    };
  });
  return cache;
}

/** Strictness: saved override on this device → env → exported bundle → 1. */
export function recognitionTolerance(library?: GestureLibrary) {
  const env = Number(import.meta.env.VITE_RECOGNITION_TOLERANCE);
  return (
    settingsService.toleranceOverride() ??
    (Number.isFinite(env) && env > 0 ? env : undefined) ??
    library?.bundleTolerance ??
    1
  );
}

/** React state of the gesture library with a retry action; loads only when enabled. */
export function useGestureLibrary(enabled = true) {
  const [state, setState] = useState<{
    status: LoadStatus;
    library?: GestureLibrary;
  }>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => gestureRepository.onChange(() => setRevision((value) => value + 1)), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadGestureLibrary().then(
      (library) => active && setState({ status: "ready", library }),
      () => active && setState({ status: "error" }),
    );
    return () => {
      active = false;
    };
  }, [revision, enabled]);
  return { ...state, retry: () => { setState({ status: "loading" }); gestureRepository.invalidate(); } };
}
