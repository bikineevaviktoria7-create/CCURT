import type { Gesture } from "../types/lesson";

// The full Russian alphabet for fingerspelling (дактиль). Ids 1–15 keep the order
// of the original lessons; the rest follow the alphabet. Letters marked "dynamic"
// are shown with a movement in Russian Sign Language — check them against a
// video dictionary (e.g. spreadthesign.com) before recording samples.
const lessonLetters = ["А", "Б", "В", "Г", "Е", "И", "Л", "М", "Н", "О", "П", "С", "Т", "У", "Ш"];
const otherLetters = ["Д", "Ё", "Ж", "З", "Й", "К", "Р", "Ф", "Х", "Ц", "Ч", "Щ", "Ъ", "Ы", "Ь", "Э", "Ю", "Я"];
const withMovement = new Set(["Д", "Ё", "З", "Й", "Ц", "Щ", "Ъ"]);

export const PLACEHOLDER_DESCRIPTION =
  "Проверенные изображение и описание этого жеста ещё не добавлены. Они появятся после проверки специалистом РЖЯ.";

export const alphabet: readonly Gesture[] = [...lessonLetters, ...otherLetters].map(
  (label, index) => ({
    id: `letter-${index + 1}`,
    slug: `letter-${index + 1}`,
    label,
    title: `Буква ${label}`,
    category: "letter",
    kind: withMovement.has(label) ? "dynamic" : "static",
    description: PLACEHOLDER_DESCRIPTION,
    difficulty: 1,
  }),
);

const byLabel = new Map(alphabet.map((letter) => [letter.label, letter]));

export function findLetterByLabel(label: string) {
  return byLabel.get(label.toUpperCase());
}
