import { useParams } from "react-router-dom";
import { useApp } from "../context/appState";
import { useLessons } from "./useLessons";

/** Lessons, progress and the lesson addressed by the `:lessonId` route parameter. */
export function useRouteLesson() {
  const { lessonId } = useParams();
  const { lessons, status, retry } = useLessons();
  const { progress } = useApp();
  const lesson = lessons.find((item) => item.id === lessonId);
  return { lesson, lessons, status, retry, progress };
}
