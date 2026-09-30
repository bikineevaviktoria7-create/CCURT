import type { Gesture, Lesson } from "../types/lesson.ts";

// «Своё имя»: ученик показывает своё имя дактилем, буква за буквой.

/** Допустимое имя: 2–12 кириллических букв или дефисов. */
export const NAME_PATTERN = /^[А-ЯЁа-яё-]{2,12}$/;

/** Первое слово введённого имени или пустая строка. */
export function firstWord(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** True, если первое слово имени подходит под NAME_PATTERN. */
export function isCyrillicName(name: string) {
  return NAME_PATTERN.test(firstWord(name));
}

export interface SpelledName {
  name: string;
  /** Буквы для тренировки по порядку (с повторами). */
  letters: Gesture[];
  /** Символы, которые пока нельзя тренировать (нет в русском алфавите или нет эталонов). */
  skipped: string[];
}

/**
 * Разбивает имя на буквы для тренировки. `available` — id жестов с записанными эталонами
 * или null, если приложение работает без эталонов (демо-режим), — тогда разрешена любая буква алфавита.
 */
export function buildSpelledName(
  name: string,
  findLetter: (label: string) => Gesture | undefined,
  available: ReadonlySet<string> | null,
): SpelledName {
  const word = firstWord(name).toUpperCase();
  const letters: Gesture[] = [];
  const skipped: string[] = [];
  for (const char of word) {
    if (char === "-") continue;
    const letter = findLetter(char);
    if (!letter || (available && !available.has(letter.id))) skipped.push(char);
    else letters.push(letter);
  }
  return { name: word, letters, skipped: [...new Set(skipped)] };
}

/** Сначала слова урока, затем имя; в теории каждая буква показывается один раз. */
export function personalizeLesson(lesson: Lesson, spelled: SpelledName | null): Lesson {
  if (lesson.personalized !== "name" || !spelled) return { ...lesson, needsName: lesson.personalized === "name" };
  if (spelled.letters.length < 2) return { ...lesson, spelledName: spelled };
  const unique = spelled.letters.filter(
    (letter, index) => spelled.letters.findIndex((item) => item.id === letter.id) === index,
  );
  return {
    ...lesson,
    spelledName: spelled,
    theoryGestures: [...lesson.gestures, ...unique],
    gestures: [...lesson.gestures, ...spelled.letters],
  };
}
