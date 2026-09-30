import { useEffect, useMemo, useState } from "react";
import { requirePlatform } from "../services/accessService";
import { lessons as lessonData } from "../data/lessons";
import { gestureReferences, findLetterByLabel, PLACEHOLDER_DESCRIPTION } from "../data/alphabet";
import { gestureRepository, type GestureContent } from "../services/gestureRepository";
import { loadGestureLibrary } from "../services/gestureLibrary";
import { settingsService, useSettings } from "../services/settingsService";
import { useApp } from "../context/appState";
import {
  buildSpelledName,
  firstWord,
  isCyrillicName,
  personalizeLesson,
} from "../lib/nameLesson";
import type { Gesture, Lesson } from "../types/lesson";
import type { LoadStatus } from "../types/loading";

/** Дольше этого уроки не ждут описаний и фото из сети. */
const CONTENT_TIMEOUT_MS = 4000;

async function loadContent(): Promise<Record<string, GestureContent>> {
  let timer: number | undefined;
  const timeout = new Promise<Record<string, GestureContent>>((resolve) => {
    timer = window.setTimeout(() => resolve({}), CONTENT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      gestureRepository.load().then(({ content }) => content, () => ({})),
      timeout,
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

function withContent(gesture: Gesture, content: Record<string, GestureContent>): Gesture {
  const item = content[gesture.id];
  // Эталон — рисунки дактиля; сохранённое фото — только запасной вариант
  // для жестов без рисунка (слова).
  const drawing = gestureReferences[gesture.id];
  gesture = { ...gesture, referenceMedia: drawing ?? gesture.referenceMedia };
  if (!item) return gesture;
  return {
    ...gesture,
    description: item.description?.trim() || gesture.description || PLACEHOLDER_DESCRIPTION,
    ...(!drawing && (item.referenceMedia || item.imageUrl)
      ? { referenceMedia: item.referenceMedia ?? { kind: "image" as const, src: item.imageUrl!, alt: `Жест «${gesture.label}»` } }
      : {}),
  };
}

async function loadLessons(): Promise<readonly Lesson[]> {
  requirePlatform();
  const content = await loadContent();
  requirePlatform();
  return lessonData.map((lesson) => ({
    ...lesson,
    gestures: lesson.gestures.map((gesture) => withContent(gesture, content)),
    ...(lesson.theoryGestures
      ? { theoryGestures: lesson.theoryGestures.map((gesture) => withContent(gesture, content)) }
      : {}),
  }));
}

/** Уроки с описаниями, фото и именем ученика; перезагружаются при смене эталонов. */
export function useLessons() {
  const [lessons, setLessons] = useState<readonly Lesson[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [revision, setRevision] = useState(0);
  const [recorded, setRecorded] = useState<{
    ids: ReadonlySet<string> | null;
    content: Record<string, GestureContent>;
  }>({ ids: null, content: {} });
  const { user } = useApp();
  const settings = useSettings();
  useEffect(() => gestureRepository.onChange(() => setRevision((value) => value + 1)), []);
  useEffect(() => {
    let active = true;
    loadLessons().then(
      (items) => {
        if (active) {
          setLessons(items);
          setStatus("ready");
        }
      },
      () => {
        if (active) setStatus("error");
      },
    );
    // Какие буквы есть в эталонах, решает, какие буквы имени можно отработать.
    loadGestureLibrary().then(
      (library) =>
        active &&
        setRecorded({
          ids: library.totalSamples ? new Set(Object.keys(library.sampleCounts)) : null,
          content: library.content as Record<string, GestureContent>,
        }),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [revision]);
  const personalized = useMemo(() => {
    if (!user) return lessons;
    const stored = settingsService.learnerName(user.id);
    const name =
      stored ?? (!user.isGuest && isCyrillicName(user.name) ? firstWord(user.name) : null);
    return lessons.map((lesson) => {
      if (lesson.personalized !== "name") return lesson;
      const spelled = name
        ? buildSpelledName(name, findLetterByLabel, recorded.ids)
        : null;
      if (spelled)
        spelled.letters = spelled.letters.map((letter) => withContent(letter, recorded.content));
      return personalizeLesson(lesson, spelled);
    });
    // `settings` меняется, когда ученик вводит имя.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons, user, recorded, settings]);
  return {
    lessons: personalized,
    status,
    retry: () => {
      setStatus("loading");
      setRevision((value) => value + 1);
    },
  };
}
