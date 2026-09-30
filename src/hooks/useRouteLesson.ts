import { useParams } from "react-router-dom";
import { useApp } from "../context/appState";
import { useLessons } from "./useLessons";

/** Уроки, прогресс и урок, заданный параметром маршрута `:lessonId`. */
export function useRouteLesson() {
  const { lessonId } = useParams();
  const { lessons, status, retry } = useLessons();
  const { progress } = useApp();
  const lesson = lessons.find((item) => item.id === lessonId);
  return { lesson, lessons, status, retry, progress };
}
