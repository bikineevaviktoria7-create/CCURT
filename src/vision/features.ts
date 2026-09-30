import {
  FINGER_CHAINS,
  FINGERS,
  angleBetween,
  cross,
  distance,
  normalizeHand,
  point,
  sub,
  unit,
} from "./normalize.ts";
import type { FeatureGroup, FingerName, Hand, Point3 } from "./types.ts";

/** Увеличивайте при изменении набора признаков: старые эталоны нужно пересчитать. */
export const FEATURE_VERSION = 1;

export interface FeatureSpec {
  key: string;
  group: FeatureGroup;
  weight: number;
}

const specs: FeatureSpec[] = [];
const add = (key: string, group: FeatureGroup, weight: number) =>
  specs.push({ key, group, weight });

// 1. Сгибание каждого сустава (0 = прямой, 1 = полностью согнут).
for (const finger of FINGERS)
  for (let joint = 1; joint <= 3; joint++)
    add(`${finger}.flex${joint}`, finger, 1);
// 2. Где кончик большого пальца относительно других пальцев и ладони.
for (const target of [8, 12, 16, 20, 5, 9])
  add(`thumb.tipTo${target}`, "thumb", 0.8);
// 3. Разведение соседних пальцев и касания кончиков.
for (const pair of ["thumb-index", "index-middle", "middle-ring", "ring-pinky"])
  add(`spread.${pair}`, "spread", 0.8);
for (const pair of ["8-12", "12-16", "16-20"])
  add(`spread.contact${pair}`, "spread", 0.6);
// 4. Ориентация ладони: нормаль к плоскости ладони и направление запястье → средний палец.
for (const axis of ["x", "y", "z"]) add(`orientation.normal.${axis}`, "orientation", 0.7);
for (const axis of ["x", "y", "z"]) add(`orientation.direction.${axis}`, "orientation", 0.7);

export const FEATURE_LAYOUT: readonly FeatureSpec[] = specs;
export const FEATURE_COUNT = specs.length;

/** Позиция именованного признака в векторе; для неизвестного ключа бросает ошибку. */
export function featureIndex(key: string) {
  const index = FEATURE_LAYOUT.findIndex((spec) => spec.key === key);
  if (index < 0) throw new Error(`Неизвестный признак ${key}`);
  return index;
}

const FINGER_BASES: Record<FingerName, [number, number]> = {
  thumb: [1, 3],
  index: [5, 6],
  middle: [9, 10],
  ring: [13, 14],
  pinky: [17, 18],
};

// Положение и размер руки убираем нормализацией, поворот сохраняем: он различает жесты.
export function extractHandFeatures(
  world: readonly Point3[],
  hand: Hand,
): number[] {
  const normalized = normalizeHand(world, hand);
  const features: number[] = [];
  // Сгибание: угол между соседними костями, делённый на π.
  for (const finger of FINGERS) {
    const chain = FINGER_CHAINS[finger];
    for (let joint = 1; joint <= 3; joint++) {
      const previous = point(normalized, chain[joint - 1] ?? 0);
      const current = point(normalized, chain[joint] ?? 0);
      const next = point(normalized, chain[joint + 1] ?? 0);
      features.push(
        angleBetween(sub(current, previous), sub(next, current)) / Math.PI,
      );
    }
  }
  // Затем расстояния, разведение пальцев и направление ладони.
  const thumbTip = point(normalized, 4);
  for (const target of [8, 12, 16, 20, 5, 9])
    features.push(distance(thumbTip, point(normalized, target)) / 2);
  const direction = (finger: FingerName) => {
    const [from, to] = FINGER_BASES[finger];
    return sub(point(normalized, to), point(normalized, from));
  };
  const pairs: [FingerName, FingerName][] = [
    ["thumb", "index"],
    ["index", "middle"],
    ["middle", "ring"],
    ["ring", "pinky"],
  ];
  for (const [a, b] of pairs)
    features.push((angleBetween(direction(a), direction(b)) / Math.PI) * 2);
  for (const [a, b] of [
    [8, 12],
    [12, 16],
    [16, 20],
  ] as const)
    features.push(distance(point(normalized, a), point(normalized, b)) / 2);
  const normal = unit(cross(sub(point(normalized, 5), point(normalized, 0)), sub(point(normalized, 17), point(normalized, 0))));
  const along = unit(sub(point(normalized, 9), point(normalized, 0)));
  features.push(normal.x, normal.y, normal.z, along.x, along.y, along.z);
  return features;
}

/** Среднее сгибание одного пальца, 0 = прямой. */
export function fingerFlexion(features: readonly number[], finger: FingerName) {
  let sum = 0;
  for (let joint = 1; joint <= 3; joint++)
    sum += features[featureIndex(`${finger}.flex${joint}`)] ?? 0;
  return sum / 3;
}

/** Читает сохранённый вектор ориентации обратно из вектора признаков. */
export function readVector(
  features: readonly number[],
  prefix: "orientation.normal" | "orientation.direction",
): Point3 {
  return {
    x: features[featureIndex(`${prefix}.x`)] ?? 0,
    y: features[featureIndex(`${prefix}.y`)] ?? 0,
    z: features[featureIndex(`${prefix}.z`)] ?? 0,
  };
}

/** Индексы признаков, входящих в группу. */
export function groupIndexes(group: FeatureGroup) {
  return FEATURE_LAYOUT.flatMap((spec, index) =>
    spec.group === group ? [index] : [],
  );
}

export const FEATURE_GROUPS: readonly FeatureGroup[] = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky",
  "spread",
  "orientation",
];
