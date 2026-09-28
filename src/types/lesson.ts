export type SectionId = 'alphabet' | 'words';
export type LessonStatus = 'completed' | 'current' | 'available' | 'locked';
export type Stars = 0 | 1 | 2 | 3;

export interface ReferenceMedia {
  kind: 'image' | 'gif' | 'video';
  src: string;
  alt: string;
  poster?: string;
}

export interface Gesture {
  id: string;
  slug: string;
  label: string;
  title: string;
  category: 'letter' | 'word';
  kind: 'static' | 'dynamic';
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
  type: 'learning' | 'practice';
  estimatedMinutes: number;
  gestures: readonly Gesture[];
}

// Progress belongs to the learner, never to the shared content repository.
export interface LessonWithProgress extends Lesson {
  status: LessonStatus;
  progress: number;
  stars: Stars;
}

export interface LessonSection {
  id: SectionId;
  number: number;
  title: string;
  description: string;
}
