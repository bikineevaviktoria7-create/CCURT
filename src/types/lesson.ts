export type SectionId = "alphabet" | "words";
export type Stars = 0 | 1 | 2 | 3;

export interface ReferenceMedia {
  kind: "image" | "gif" | "video";
  src: string;
  alt: string;
  poster?: string;
}

export interface Gesture {
  id: string;
  slug: string;
  label: string;
  title: string;
  category: "letter" | "word";
  kind: "static";
  /** Полный жест включает движение; тренажёр оценивает только положение руки. */
  positionOnly?: boolean;
  description: string;
  referenceMedia?: ReferenceMedia;
  difficulty: 1 | 2 | 3;
}

export interface Lesson {
  id: string;
  sectionId: SectionId;
  number: number;
  title: string;
  description: string;
  type: "learning" | "practice";
  estimatedMinutes: number;
  gestures: readonly Gesture[];
  /** "name": после слов имя ученика показывается дактилем по буквам. */
  personalized?: "name";
  /** Список для теории, если он отличается от практики (каждая буква имени — один раз). */
  theoryGestures?: readonly Gesture[];
  /** Персональный урок, который ещё ждёт имя ученика. */
  needsName?: boolean;
  spelledName?: { name: string; skipped: string[]; letters: readonly Gesture[] };
}

export interface LessonSection {
  id: SectionId;
  number: number;
  title: string;
  description: string;
}
