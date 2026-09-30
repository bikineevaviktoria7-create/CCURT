import { alphabet, findLetterByLabel, PLACEHOLDER_DESCRIPTION } from "./alphabet.ts";
import type { Gesture, Lesson, LessonSection } from "../types/lesson";

// Lesson structure lives in code (stable, works offline). Gesture descriptions and
// photos are loaded from the database / saved samples and merged in useLessons.

export const lessonSections: readonly LessonSection[] = [
  { id: "alphabet", number: 1, title: "Алфавит", description: "От первых букв к уверенной практике" },
  { id: "words", number: 2, title: "Основные слова", description: "Первые шаги к общению на русском жестовом языке" },
];

const alphabetTitles = [
  "Первые буквы", "Продолжаем", "Новые формы", "Положение ладони", "Завершаем набор",
  "Повторение I", "Повторение II", "Повторение III", "Смешанная практика", "Итог: первые 15 букв",
];

const alphabetGroups = [
  ["А", "Б", "В"], ["Г", "И", "Е"], ["Л", "М", "Н"], ["О", "П", "С"], ["Т", "У", "Ш"],
  ["А", "Б", "В", "Г", "Е"], ["И", "Л", "М", "Н", "О"], ["П", "С", "Т", "У", "Ш"],
  ["А", "И", "М", "П", "Ш"], ["Б", "Г", "Л", "О", "Т"],
];

// The remaining 18 letters: first the static ones grouped by similar hand shapes,
// then letters with a movement (several of them are a known shape + movement).
const moreAlphabetLessons: { id: string; title: string; description: string; labels: string[] }[] = [
  { id: "21", title: "Согнутые пальцы", description: "Пальцы согнуты под прямым углом: Ж, Ф, Ч.", labels: ["Ж", "Ф", "Ч"] },
  { id: "22", title: "Кольцо, рожки, скрещивание", description: "Новые формы кисти: Р, Ы, Я.", labels: ["Р", "Ы", "Я"] },
  { id: "23", title: "Крючок и полукольцо", description: "Изогнутые пальцы: Х, Э, Ю.", labels: ["Х", "Э", "Ю"] },
  { id: "24", title: "Буквы с движением", description: "Рука рисует букву в воздухе: Д, З, Ц.", labels: ["Д", "З", "Ц"] },
  { id: "25", title: "Знакомые формы в движении", description: "Е, И, Ш с движением превращаются в Ё, Й, Щ.", labels: ["Ё", "Й", "Щ"] },
  { id: "26", title: "К и знаки", description: "Короткие движения кистью: К, Ь, Ъ.", labels: ["К", "Ь", "Ъ"] },
];

const wordDefinitions = [
  ["hello", "Привет"], ["goodbye", "Пока"], ["yes", "Да"], ["no", "Нет"],
  ["thanks", "Спасибо"], ["please", "Пожалуйста"], ["sorry", "Извините"],
  ["name", "Имя"], ["me", "Я"], ["you", "Вы"], ["help", "Помощь"],
  ["repeat", "Повторите"], ["understand", "Понимать"], ["home", "Дом"], ["water", "Вода"],
] as const;

// Only a recorded hand position is evaluated; movement is not assessed.
export const words: readonly Gesture[] = wordDefinitions.map(([slug, label]) => ({
  id: `word-${slug}`, slug, label, title: label, category: "word", kind: "static", positionOnly: true,
  description: PLACEHOLDER_DESCRIPTION, difficulty: 1,
}));

export const allGestures: readonly Gesture[] = [...alphabet, ...words];

// New IDs keep archived results from unrelated old word lessons from unlocking these topics.
const wordLessonDefinitions = [
  { id: "words-hello", title: "Привет", slugs: ["hello"] },
  { id: "words-goodbye", title: "Пока", slugs: ["goodbye"] },
  { id: "words-yes", title: "Да", slugs: ["yes"] },
  { id: "words-no", title: "Нет", slugs: ["no"] },
  { id: "words-review", title: "Повторение", slugs: ["hello", "goodbye", "yes", "no"] },
  { id: "words-final", title: "Итоговый урок", slugs: ["hello", "goodbye", "yes", "no"] },
];

const letters = (labels: readonly string[]) =>
  labels.flatMap((label) => {
    const letter = findLetterByLabel(label);
    return letter ? [letter] : [];
  });

export const lessons: readonly Lesson[] = [
  ...alphabetTitles.map<Lesson>((title, index) => ({
    id: String(index + 1), sectionId: "alphabet", number: index + 1, title,
    description: index < 5 ? "Познакомьтесь с новой группой букв." : "Закрепите буквы из предыдущих занятий.",
    type: index < 5 ? "learning" : "practice", estimatedMinutes: 5,
    gestures: letters(alphabetGroups[index] ?? []),
  })),
  ...moreAlphabetLessons.map<Lesson>(({ id, title, description, labels }, index) => ({
    id, sectionId: "alphabet", number: alphabetTitles.length + index + 1, title, description,
    type: "learning", estimatedMinutes: 5, gestures: letters(labels),
  })),
  ...wordLessonDefinitions.map<Lesson>(({ id, title, slugs }, index) => ({
    id, sectionId: "words", number: index + 1, title,
    description: index < 4 ? "Изучите слово и положение руки" : "Повторите четыре изученных слова",
    type: index < 4 ? "learning" : "practice", estimatedMinutes: 5,
    gestures: slugs.flatMap((slug) => words.filter((gesture) => gesture.slug === slug)),
  })),
];
