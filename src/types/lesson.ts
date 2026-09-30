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
  /** Full gesture includes movement; this trainer evaluates hand position only. */
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
  /** "name": the learner's own name is spelled letter by letter after the words. */
  personalized?: "name";
  /** Theory list when it differs from practice (each name letter shown once). */
  theoryGestures?: readonly Gesture[];
  /** Personalised lesson that still waits for the learner's name. */
  needsName?: boolean;
  spelledName?: { name: string; skipped: string[]; letters: readonly Gesture[] };
}

export interface LessonSection {
  id: SectionId;
  number: number;
  title: string;
  description: string;
}
