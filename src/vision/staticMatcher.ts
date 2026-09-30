import { FEATURE_COUNT, FEATURE_VERSION, FEATURE_GROUPS, FEATURE_LAYOUT, groupIndexes } from "./features.ts";
import type { FeatureGroup, GestureSample } from "./types.ts";

/** Значения подобраны для FEATURE_VERSION 1; строгость меняется ползунком допуска. */
// Расстояния — взвешенное среднеквадратичное по вектору признаков (см. weightedDistance).
export const MIN_ACCEPT_DISTANCE = 0.07;
export const MAX_ACCEPT_DISTANCE = 0.22;
export const DEFAULT_ACCEPT_DISTANCE = 0.12;

/** Минимальное отклонение в группе признаков (взвешенное СКО), которое считается ошибкой. */
const MIN_GROUP_THRESHOLD: Record<FeatureGroup, number> = {
  thumb: 0.11,
  index: 0.11,
  middle: 0.11,
  ring: 0.11,
  pinky: 0.11,
  spread: 0.1,
  orientation: 0.22,
};

export interface StaticGestureModel {
  gestureId: string;
  samples: number[][];
  acceptDistance: number;
  groupThreshold: Record<FeatureGroup, number>;
}

export interface GestureMatch {
  gestureId: string;
  distance: number;
}

/** Взвешенная среднеквадратичная разница двух полных векторов признаков. */
export function weightedDistance(a: readonly number[], b: readonly number[]) {
  let sum = 0;
  for (let index = 0; index < FEATURE_LAYOUT.length; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    sum += (FEATURE_LAYOUT[index]?.weight ?? 1) * difference * difference;
  }
  return Math.sqrt(sum / FEATURE_LAYOUT.length);
}

/** Взвешенная среднеквадратичная разница внутри одной группы признаков. */
export function groupDeviation(
  a: readonly number[],
  b: readonly number[],
  group: FeatureGroup,
) {
  const indexes = groupIndexes(group);
  let sum = 0;
  let weights = 0;
  for (const index of indexes) {
    const weight = FEATURE_LAYOUT[index]?.weight ?? 1;
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    sum += weight * difference * difference;
    weights += weight;
  }
  return weights ? Math.sqrt(sum / weights) : 0;
}

const mean = (values: readonly number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const deviation = (values: readonly number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function centroid(vectors: readonly number[][]) {
  return FEATURE_LAYOUT.map((_, index) =>
    mean(vectors.map((vector) => vector[index] ?? 0)),
  );
}

/**
 * По записанным эталонам одного жеста определяет, насколько новая попытка может
 * от них отличаться и всё ещё засчитываться, — пороги следуют за записями команды.
 */
export function buildStaticModel(
  gestureId: string,
  vectors: readonly number[][],
): StaticGestureModel {
  const samples = vectors.map((vector) => [...vector]);
  let acceptDistance = DEFAULT_ACCEPT_DISTANCE;
  if (samples.length >= 2) {
    const nearest = samples.map((sample, index) =>
      Math.min(
        ...samples
          .filter((_, other) => other !== index)
          .map((other) => weightedDistance(sample, other)),
      ),
    );
    acceptDistance = clamp(
      (mean(nearest) + 2 * deviation(nearest)) * 1.6,
      MIN_ACCEPT_DISTANCE,
      MAX_ACCEPT_DISTANCE,
    );
  }
  const center = centroid(samples);
  const groupThreshold = {} as Record<FeatureGroup, number>;
  for (const group of FEATURE_GROUPS) {
    const spread = samples.map((sample) => groupDeviation(sample, center, group));
    groupThreshold[group] = Math.max(
      MIN_GROUP_THRESHOLD[group],
      (mean(spread) + 2 * deviation(spread)) * 1.5,
    );
  }
  return { gestureId, samples, acceptDistance, groupThreshold };
}

/** Отсеивает устаревшие и неполные векторы, пока они не исказили расстояния и пороги. */
export function isStaticSample(sample: GestureSample): boolean {
  return sample.featureVersion === FEATURE_VERSION && Array.isArray(sample.features) &&
    sample.features.length === FEATURE_COUNT && sample.features.every(Number.isFinite);
}

/** Группирует эталоны по жестам и строит по одной статической модели на жест. */
export function buildStaticModels(samples: readonly GestureSample[]) {
  const byGesture = new Map<string, number[][]>();
  for (const sample of samples) {
    if (!isStaticSample(sample) || !sample.features) continue;
    const list = byGesture.get(sample.gestureId) ?? [];
    list.push(sample.features);
    byGesture.set(sample.gestureId, list);
  }
  const models = new Map<string, StaticGestureModel>();
  for (const [gestureId, vectors] of byGesture)
    models.set(gestureId, buildStaticModel(gestureId, vectors));
  return models;
}

/** Расстояние до жеста — среднее двух ближайших эталонов (устойчиво к одному плохому эталону). */
export function distanceToStaticModel(
  features: readonly number[],
  model: StaticGestureModel,
) {
  const distances = model.samples
    .map((sample) => weightedDistance(features, sample))
    .sort((a, b) => a - b);
  const first = distances[0] ?? Infinity;
  const second = distances[1] ?? first;
  return (first + second) / 2;
}

/** Записанный эталон, ближайший к входному вектору. */
export function nearestSample(
  features: readonly number[],
  model: StaticGestureModel,
) {
  let best = model.samples[0] ?? [];
  let bestDistance = Infinity;
  for (const sample of model.samples) {
    const value = weightedDistance(features, sample);
    if (value < bestDistance) {
      bestDistance = value;
      best = sample;
    }
  }
  return best;
}

/** Все известные жесты, от ближайшего к дальнему. */
export function rankGestures(
  features: readonly number[],
  models: ReadonlyMap<string, StaticGestureModel>,
): GestureMatch[] {
  return [...models.values()]
    .map((model) => ({
      gestureId: model.gestureId,
      distance: distanceToStaticModel(features, model),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/** Сходство с целью 0–1: 1 на эталонах, 0.5 на границе принятия. */
export function similarity(distance: number, acceptDistance: number) {
  return clamp(1 - (distance / acceptDistance) * 0.5, 0, 1);
}

export interface StaticDecision {
  nearest: GestureMatch;
  distance: number;
  accept: number;
  /** Ближайший другой жест, если он сам в пределах своего порога принятия. */
  rival?: GestureMatch;
  matched: boolean;
}

/**
 * Цель принимается, только если она достаточно близка И никакой другой известный жест
 * не ближе явно, — так похожая буква никогда не засчитывается вместо цели.
 */
export function compareStaticGesture(
  features: readonly number[],
  targetId: string,
  models: ReadonlyMap<string, StaticGestureModel>,
  tolerance = 1,
): StaticDecision | undefined {
  const model = models.get(targetId);
  if (!model) return undefined;
  const distance = distanceToStaticModel(features, model);
  const accept = model.acceptDistance * tolerance;
  const other = rankGestures(features, models).find((match) => match.gestureId !== targetId);
  const otherModel = other ? models.get(other.gestureId) : undefined;
  const rival =
    other && otherModel && other.distance <= otherModel.acceptDistance * tolerance
      ? other
      : undefined;
  const matched = distance <= accept && !(rival && rival.distance < distance * 0.75);
  return { distance, accept, rival, matched, nearest: other && other.distance < distance ? other : { gestureId: targetId, distance } };
}

/**
 * Добавляет модели для букв, у которых та же форма кисти, что у другой буквы, плюс движение
 * (Ё — Е, Й — И, Щ — Ш). Движение не оценивается, положение руки сравнивается по эталонам базовой буквы.
 * `aliases` — пары [id буквы с движением, id базовой буквы]; собственные эталоны буквы важнее.
 */
export function withShapeAliases(
  models: ReadonlyMap<string, StaticGestureModel>,
  aliases: readonly (readonly [string, string])[],
) {
  const result = new Map(models);
  for (const [aliasId, baseId] of aliases) {
    const base = models.get(baseId);
    if (base && !models.has(aliasId)) result.set(aliasId, { ...base, gestureId: aliasId });
  }
  return result;
}
