import type { Gesture, Lesson } from "../types/lesson.ts";

// «Своё имя»: the learner spells their own name in fingerspelling, letter by letter.

export const NAME_PATTERN = /^[А-ЯЁа-яё-]{2,12}$/;

export function firstWord(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function isCyrillicName(name: string) {
  return NAME_PATTERN.test(firstWord(name));
}

export interface NameLetters {
  name: string;
  /** Letters to practise, in order (repeats included). */
  letters: Gesture[];
  /** Characters that cannot be practised yet (not in the Russian alphabet or no samples). */
  skipped: string[];
}

/**
 * @param available ids of gestures with recorded samples, or null when the app runs
 *   without samples (demo mode) — then every alphabet letter is allowed.
 */
export function buildNameGestures(
  name: string,
  findLetter: (label: string) => Gesture | undefined,
  available: ReadonlySet<string> | null,
): NameLetters {
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

/** Words of the lesson first, then the name; theory shows each letter once. */
export function personalizeLesson(lesson: Lesson, spelled: NameLetters | null): Lesson {
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
