import type { Gesture, Lesson, LessonSection } from "../types/lesson";
import { alphabet, findLetterByLabel, PLACEHOLDER_DESCRIPTION } from "./alphabet.ts";

// Lesson structure lives in code (stable, works offline). Gesture descriptions and
// photos are loaded from the database / admin panel and merged in useLessons.

export const lessonSections: readonly LessonSection[] = [
  { id: "alphabet", number: 1, title: "Алфавит", description: "От первых букв к уверенной практике" },
  { id: "words", number: 2, title: "Основные слова", description: "Первые шаги к общению на РЖЯ" },
];

const alphabetTitles = [
  "Первые буквы", "Продолжаем", "Новые формы", "Положение ладони", "Завершаем набор",
  "Повторение I", "Повторение II", "Повторение III", "Смешанная практика", "Итог: Алфавит",
];

const alphabetGroups = [
  ["А", "Б", "В"], ["Г", "Е", "И"], ["Л", "М", "Н"], ["О", "П", "С"], ["Т", "У", "Ш"],
  ["А", "Б", "В", "Г", "Е"], ["И", "Л", "М", "Н", "О"], ["П", "С", "Т", "У", "Ш"],
  ["А", "И", "М", "П", "Ш"], ["Б", "Г", "Л", "О", "Т"],
];

const wordDefinitions = [
  ["hello", "Привет"], ["goodbye", "До свидания"], ["yes", "Да"], ["no", "Нет"],
  ["thanks", "Спасибо"], ["please", "Пожалуйста"], ["sorry", "Извините"],
  ["name", "Имя"], ["me", "Я"], ["you", "Вы"], ["help", "Помощь"],
  ["repeat", "Повторите"], ["understand", "Понимать"], ["home", "Дом"], ["water", "Вода"],
] as const;

// Words are signed with a movement, so they are matched as dynamic gestures.
export const words: readonly Gesture[] = wordDefinitions.map(([slug, label]) => ({
  id: `word-${slug}`, slug, label, title: label, category: "word", kind: "dynamic",
  description: PLACEHOLDER_DESCRIPTION, difficulty: 1,
}));

export const allGestures: readonly Gesture[] = [...alphabet, ...words];

const wordLessonDefinitions: { title: string; slugs: string[]; personalized?: "name" }[] = [
  { title: "Приветствие", slugs: ["hello", "goodbye"] },
  { title: "Да и нет", slugs: ["yes", "no"] },
  { title: "Благодарность", slugs: ["thanks", "please"] },
  { title: "Вежливые слова", slugs: ["please", "sorry", "thanks"] },
  { title: "Знакомство: своё имя", slugs: ["name", "me", "you"], personalized: "name" },
  { title: "Просьбы", slugs: ["help", "repeat", "please"] },
  { title: "Повседневные слова", slugs: ["home", "water", "understand"] },
  { title: "Смешанная практика", slugs: ["hello", "name", "thanks", "goodbye"] },
  { title: "Повторение", slugs: ["yes", "no", "help", "repeat"] },
  { title: "Итоговый урок", slugs: ["hello", "please", "thanks", "understand", "goodbye"] },
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
  ...wordLessonDefinitions.map<Lesson>(({ title, slugs, personalized }, index) => ({
    id: String(index + 11), sectionId: "words", number: index + 1, title,
    description: personalized
      ? "Научитесь представляться: слова знакомства и своё имя дактилем."
      : index < 7 ? "Познакомьтесь со словами для повседневного общения." : "Повторите знакомые слова и выражения.",
    type: index < 7 ? "learning" : "practice", estimatedMinutes: 5,
    gestures: slugs.flatMap((slug) => words.filter((gesture) => gesture.slug === slug)),
    ...(personalized ? { personalized } : {}),
  })),
];
