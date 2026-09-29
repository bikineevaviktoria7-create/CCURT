import { useEffect, useMemo, useState } from "react";
import { requirePlatform } from "../services/accessService";
import { lessons as lessonData } from "../data/lessons";
import { gestureReferences, findLetterByLabel, PLACEHOLDER_DESCRIPTION } from "../data/alphabet";
import { gestureRepository } from "../services/gestureRepository";
import { loadGestureLibrary } from "../services/gestureLibrary";
import { settingsService, useSettings } from "../services/settingsService";
import { useApp } from "../context/appState";
import {
  buildNameGestures,
  firstWord,
  isCyrillicName,
  personalizeLesson,
} from "../lib/nameLesson";
import type { Gesture, Lesson } from "../types/lesson";
import type { GestureContent } from "../services/gestureRepository";

/** Lessons never wait longer than this for descriptions/photos from the network. */
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
  // The dactyl chart drawings are the reference; a saved photo is
  // only a fallback for gestures that have no drawing (words).
  const drawing = gestureReferences[gesture.id];
  gesture = { ...gesture, referenceMedia: drawing ?? gesture.referenceMedia };
  if (!item) return gesture;
  return {
    ...gesture,
    description: item.description?.trim() || gesture.description || PLACEHOLDER_DESCRIPTION,
    ...(!drawing && item.imageUrl
      ? { referenceMedia: { kind: "image" as const, src: item.imageUrl, alt: `Жест «${gesture.label}»` } }
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
  }));
}

export function useLessons() {
  const [lessons, setLessons] = useState<readonly Lesson[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
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
    // Which letters have samples decides which letters of a name can be practised.
    loadGestureLibrary().then(
      (context) =>
        active &&
        setRecorded({
          ids: context.totalSamples ? new Set(Object.keys(context.sampleCounts)) : null,
          content: context.content as Record<string, GestureContent>,
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
        ? buildNameGestures(name, findLetterByLabel, recorded.ids)
        : null;
      if (spelled)
        spelled.letters = spelled.letters.map((letter) => withContent(letter, recorded.content));
      return personalizeLesson(lesson, spelled);
    });
    // `settings` changes when the learner enters their name.
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
