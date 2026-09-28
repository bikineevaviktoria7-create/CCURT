import type { Gesture, Lesson, LessonSection } from '../types/lesson';

export const lessonSections: readonly LessonSection[] = [
  { id: 'alphabet', number: 1, title: 'Алфавит', description: 'От первых букв к уверенной практике' },
  { id: 'words', number: 2, title: 'Основные слова', description: 'Первые шаги к общению на РЖЯ' },
];

const placeholderDescription =
  'Проверенные материалы РЖЯ для этого жеста ещё не добавлены. Положение руки и техника выполнения появятся вместе с эталоном.';

const letterGroups = [
  ['А', 'Б', 'В'], ['Г', 'Е', 'И'], ['Л', 'М', 'Н'], ['О', 'П', 'С'], ['Т', 'У', 'Ш'],
] as const;

const letters = letterGroups.flat().map<Gesture>((label, index) => ({
  id: `letter-${index + 1}`,
  slug: `letter-${index + 1}`,
  label,
  title: `Буква ${label}`,
  category: 'letter',
  kind: 'static',
  description: placeholderDescription,
  difficulty: 1,
}));

const alphabetTitles = [
  'Первые буквы', 'Продолжаем', 'Новые формы', 'Положение ладони', 'Завершаем набор',
  'Повторение I', 'Повторение II', 'Повторение III', 'Смешанная практика', 'Итог: Алфавит',
];

const alphabetGroups = [
  ['А', 'Б', 'В'], ['Г', 'Е', 'И'], ['Л', 'М', 'Н'], ['О', 'П', 'С'], ['Т', 'У', 'Ш'],
  ['А', 'Б', 'В', 'Г', 'Е'], ['И', 'Л', 'М', 'Н', 'О'], ['П', 'С', 'Т', 'У', 'Ш'],
  ['А', 'И', 'М', 'П', 'Ш'], ['Б', 'Г', 'Л', 'О', 'Т'],
];

const wordDefinitions = [
  ['hello', 'Привет'], ['goodbye', 'До свидания'], ['yes', 'Да'], ['no', 'Нет'],
  ['thanks', 'Спасибо'], ['please', 'Пожалуйста'], ['sorry', 'Извините'],
  ['name', 'Имя'], ['me', 'Я'], ['you', 'Вы'], ['help', 'Помощь'],
  ['repeat', 'Повторите'], ['understand', 'Понимать'], ['home', 'Дом'], ['water', 'Вода'],
] as const;

// Word kinds are provisional catalog metadata, not verified movement instructions.
const words = wordDefinitions.map<Gesture>(([slug, label]) => ({
  id: `word-${slug}`, slug, label, title: label, category: 'word', kind: 'dynamic',
  description: placeholderDescription, difficulty: 1,
}));

const wordLessonDefinitions = [
  { title: 'Приветствие', slugs: ['hello', 'goodbye'] },
  { title: 'Да и нет', slugs: ['yes', 'no'] },
  { title: 'Благодарность', slugs: ['thanks', 'please'] },
  { title: 'Вежливые слова', slugs: ['please', 'sorry', 'thanks'] },
  { title: 'Знакомство', slugs: ['name', 'me', 'you'] },
  { title: 'Просьбы', slugs: ['help', 'repeat', 'please'] },
  { title: 'Повседневные слова', slugs: ['home', 'water', 'understand'] },
  { title: 'Смешанная практика', slugs: ['hello', 'name', 'thanks', 'goodbye'] },
  { title: 'Повторение', slugs: ['yes', 'no', 'help', 'repeat'] },
  { title: 'Итоговый урок', slugs: ['hello', 'please', 'thanks', 'understand', 'goodbye'] },
];

export const mockLessons: readonly Lesson[] = [
  ...alphabetTitles.map<Lesson>((title, index) => ({
    id: String(index + 1), sectionId: 'alphabet', number: index + 1, title,
    description: index < 5 ? 'Познакомьтесь с новой группой букв.' : 'Закрепите буквы из предыдущих занятий.',
    type: index < 5 ? 'learning' : 'practice', estimatedMinutes: 5,
    gestures: letters.filter((gesture) => alphabetGroups[index]?.includes(gesture.label)),
  })),
  ...wordLessonDefinitions.map<Lesson>(({ title, slugs }, index) => ({
    id: String(index + 11), sectionId: 'words', number: index + 1, title,
    description: index < 7 ? 'Познакомьтесь со словами для повседневного общения.' : 'Повторите знакомые слова и выражения.',
    type: index < 7 ? 'learning' : 'practice', estimatedMinutes: 5,
    gestures: words.filter((gesture) => slugs.includes(gesture.slug)),
  })),
];
