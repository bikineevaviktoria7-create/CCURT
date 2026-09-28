import type { FingerName } from "./types.ts";

// All user-facing recognition texts live here: short, polite («вы»), one action.

export const FINGER_TITLES: Record<FingerName, string> = {
  thumb: "большой палец",
  index: "указательный палец",
  middle: "средний палец",
  ring: "безымянный палец",
  pinky: "мизинец",
};

export type FingerPair = "thumb-index" | "index-middle" | "middle-ring" | "ring-pinky";

export const PAIR_TITLES: Record<FingerPair, string> = {
  "thumb-index": "большой и указательный пальцы",
  "index-middle": "указательный и средний пальцы",
  "middle-ring": "средний и безымянный пальцы",
  "ring-pinky": "безымянный палец и мизинец",
};

export const PAIR_FINGERS: Record<FingerPair, [FingerName, FingerName]> = {
  "thumb-index": ["thumb", "index"],
  "index-middle": ["index", "middle"],
  "middle-ring": ["middle", "ring"],
  "ring-pinky": ["ring", "pinky"],
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const hints = {
  bendFinger: (finger: FingerName) =>
    `Согните ${FINGER_TITLES[finger]} — сейчас он выпрямлен.`,
  straightenFinger: (finger: FingerName) =>
    `Выпрямите ${FINGER_TITLES[finger]} — сейчас он согнут.`,
  fingerShape: (finger: FingerName, state: "straight" | "half" | "bent") =>
    `${capitalize(FINGER_TITLES[finger])} должен быть ${
      state === "straight" ? "выпрямлен" : state === "bent" ? "согнут" : "полусогнут"
    }, как на фото.`,
  touchThumbIndex: () =>
    "Соедините большой и указательный пальцы — кончики должны касаться.",
  releaseThumbIndex: () =>
    "Разомкните большой и указательный пальцы — между ними нужен просвет.",
  thumbToPalm: () => "Прижмите большой палец к ладони.",
  thumbAway: () => "Отведите большой палец в сторону от ладони.",
  spreadWider: (pair: FingerPair) => `Разведите ${PAIR_TITLES[pair]} шире.`,
  closeTogether: (pair: FingerPair) => `Сомкните ${PAIR_TITLES[pair]} вместе.`,
  pointFingers: (direction: string) => `Направьте пальцы ${direction}.`,
  turnPalm: (target: string, current: string) =>
    `Поверните ладонь ${target} — сейчас она ${current}.`,
  similarTo: (label: string, correction?: string) =>
    `Сейчас это похоже на «${label}».${correction ? ` ${correction}` : ""}`,
  handLocation: (direction: string) => `Переместите руку ${direction}.`,
  moveWider: () => "Сделайте движение шире.",
  moveSmaller: () => "Сделайте движение короче и аккуратнее.",
  moveSlower: () => "Сделайте движение медленнее.",
  moveFaster: () => "Сделайте движение чуть быстрее и увереннее.",
  handNotVisible: () => "Покажите руку в камеру.",
  handCut: () => "Рука не полностью в кадре — отодвиньте её немного дальше.",
  handTooFar: () => "Рука слишком далеко — придвиньте её ближе к камере.",
  lowLight: () => "Слишком темно — включите свет или повернитесь к окну.",
  holdStill: () => "Удерживайте жест…",
  checking: () => "Проверяем жест…",
  startMoving: () => "Покажите жест целиком — движение начнётся с руки в кадре.",
  recording: () => "Записываем движение…",
  noSamples: () =>
    "Проверенные эталоны этого жеста ещё не добавлены. Оценка жеста пока недоступна.",
} as const;
