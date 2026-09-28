import { useEffect, useState } from "react";
import { lessonService } from "../services/lessonService";
import type { Lesson } from "../types/lesson";

export function useLessons() {
  const [lessons, setLessons] = useState<readonly Lesson[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    lessonService.getLessons().then(
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
    return () => {
      active = false;
    };
  }, [revision]);
  return {
    lessons,
    status,
    retry: () => {
      setStatus("loading");
      setRevision((value) => value + 1);
    },
  };
}
