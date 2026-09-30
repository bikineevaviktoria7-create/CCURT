import { useEffect, useState } from "react";
import { findLetterByLabel } from "../data/alphabet";
import { allGestures } from "../data/lessons";
import { buildStaticModels, withShapeAliases, type StaticGestureModel } from "../vision/staticMatcher";
import { gestureRepository, type GestureContent } from "./gestureRepository";
import { settingsService } from "./settingsService";
import type { LoadStatus } from "../types/loading";

/** Модели жестов, построенные по эталонам, а также подписи и контент для UI. */
export interface GestureLibrary {
  staticModels: ReadonlyMap<string, StaticGestureModel>;
  labels: Readonly<Record<string, string>>;
  content: Readonly<Record<string, GestureContent>>;
  sampleCounts: Readonly<Record<string, number>>;
  totalSamples: number;
  bundleTolerance?: number;
}

/** Буквы с движением, форма кисти которых совпадает с другой буквой: [буква, базовая буква]. */
const SHAPE_ALIASES = [["Ё", "Е"], ["Й", "И"], ["Щ", "Ш"]] as const;

/** Пары id для `withShapeAliases`. */
export const shapeAliasIds = SHAPE_ALIASES.flatMap(([alias, base]) => {
  const aliasLetter = findLetterByLabel(alias);
  const baseLetter = findLetterByLabel(base);
  return aliasLetter && baseLetter ? [[aliasLetter.id, baseLetter.id] as const] : [];
});

let cache: Promise<GestureLibrary> | null = null;
gestureRepository.onChange(() => {
  cache = null;
});

/** Загружает эталоны один раз и строит модели; кеш сбрасывается при смене эталонов. */
export function loadGestureLibrary() {
  cache ??= gestureRepository.load().then(({ samples, content, tolerance }) => {
    const staticModels = withShapeAliases(buildStaticModels(samples), shapeAliasIds);
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

/** Строгость: сохранённая на устройстве настройка → env → выгруженный набор → 1. */
export function recognitionTolerance(library?: GestureLibrary) {
  const env = Number(import.meta.env.VITE_RECOGNITION_TOLERANCE);
  return (
    settingsService.toleranceOverride() ??
    (Number.isFinite(env) && env > 0 ? env : undefined) ??
    library?.bundleTolerance ??
    1
  );
}

/** Состояние библиотеки жестов для React с повторной загрузкой; грузит, только если включено. */
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
