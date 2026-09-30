import { alphabet, findLetterByLabel, PLACEHOLDER_DESCRIPTION } from "./alphabet.ts";
import type { Gesture, Lesson, LessonSection } from "../types/lesson";

// Структура уроков хранится в коде (стабильна, работает офлайн). Описания и фото жестов
// загружаются из базы или сохранённых эталонов и объединяются в useLessons.

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

// Остальные 18 букв: сначала статичные, сгруппированные по похожей форме кисти,
// затем буквы с движением (часть из них — знакомая форма плюс движение).
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

/** Базовые слова раздела показываются дактилем: слово — последовательность букв с эталонами. */
const wordSpellings: Readonly<Partial<Record<string, string>>> = {
  hello: "ПРИВЕТ", goodbye: "ПОКА", yes: "ДА", no: "НЕТ",
};

/** Буквы слова по порядку (с повторами). */
const spelling = (slug: string) => [...(wordSpellings[slug] ?? "")];

// Слова без разбивки на буквы оцениваются только по положению руки, движение не проверяется.
export const words: readonly Gesture[] = wordDefinitions.map(([slug, label]) => {
  const spelled = spelling(slug);
  return {
    id: `word-${slug}`, slug, label, title: label, category: "word", kind: "static",
    positionOnly: spelled.length === 0,
    description: spelled.length
      ? `Слово показывается дактилем, буква за буквой: ${spelled.join(" · ")}.`
      : PLACEHOLDER_DESCRIPTION,
    ...(spelled.length
      ? {
        referenceMedia: {
          kind: "image" as const,
          src: `/assets/gestures/words/word-${slug}.webp`,
          alt: `Слово «${label}» дактилем: ${spelled.join(", ")}`,
        },
      }
      : {}),
    difficulty: 1,
  };
});

export const allGestures: readonly Gesture[] = [...alphabet, ...words];

// Новые id не дают архивным результатам старых уроков слов открыть эти темы.
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
  // Теория — слово целиком (рисунок последовательности), практика — его буквы по порядку.
  ...wordLessonDefinitions.map<Lesson>(({ id, title, slugs }, index) => ({
    id, sectionId: "words", number: index + 1, title,
    description: index < 4 ? "Изучите слово и покажите его дактилем по буквам" : "Покажите четыре изученных слова дактилем",
    type: index < 4 ? "learning" : "practice", estimatedMinutes: 5,
    theoryGestures: slugs.flatMap((slug) => words.filter((gesture) => gesture.slug === slug)),
    gestures: slugs.flatMap((slug) => letters(spelling(slug))),
  })),
];
