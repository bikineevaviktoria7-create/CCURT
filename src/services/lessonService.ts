import { lessonSections, mockLessons } from '../data/mockLessons';
import type { Lesson, LessonSection } from '../types/lesson';

export interface LessonRepository {
  getSections(): Promise<readonly LessonSection[]>;
  getLessons(): Promise<readonly Lesson[]>;
  getLesson(id: string): Promise<Lesson | null>;
}

export const lessonService: LessonRepository = {
  async getSections() { return lessonSections; },
  async getLessons() { return mockLessons; },
  async getLesson(id) { return mockLessons.find((lesson) => lesson.id === id) ?? null; },
};
