import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import { Page } from "../components/layout/Page";
import { ContentState } from "../components/common/ContentState";
import { GestureReference } from "../components/lessons/GestureReference";
import { useLessons } from "../hooks/useLessons";
import { useApp } from "../context/appState";
import { lessonStatus } from "../services/progressService";
import { ROUTES } from "../app/constants";

export function LessonOverviewPage() {
  const { lessonId } = useParams();
  const { lessons, status, retry } = useLessons();
  const { progress } = useApp();
  const lesson = lessons.find((item) => item.id === lessonId);
  return (
    <Page>
      <Link to={ROUTES.dashboard} className="back-link">
        <ArrowLeft size={18} />
        Вернуться на главную
      </Link>
      {status !== "ready" ? (
        <ContentState status={status} retry={retry} />
      ) : !lesson ? (
        <ContentState status="missing" />
      ) : lessonStatus(lesson, lessons, progress) === "locked" ? (
        <ContentState status="locked" />
      ) : (
        <section className="lesson-overview">
          <p className="eyebrow">
            Раздел:{" "}
            {lesson.sectionId === "alphabet" ? "Алфавит" : "Основные слова"}
          </p>
          <p className="lesson-number">
            Урок {lesson.number} · {lesson.title}
          </p>
          <h1>
            На этом занятии
            <br />
            мы изучим:
          </h1>
          <div className="overview-gestures">
            {lesson.gestures.map((gesture) => (
              <div className="overview-gesture" key={gesture.id}>
                <GestureReference gesture={gesture} />
                <h2>{gesture.title}</h2>
              </div>
            ))}
          </div>
          <p className="overview-meta">
            <Clock3 size={18} />
            Около {lesson.estimatedMinutes} минут <span>·</span> Сначала
            изучаем, затем практикуемся
          </p>
          <div className="center-actions">
            <Link
              className="button button--primary"
              to={ROUTES.play(lesson.id)}
            >
              Начать
              <ArrowRight size={18} />
            </Link>
            <Link className="text-link" to={ROUTES.dashboard}>
              Вернуться на главную
            </Link>
          </div>
        </section>
      )}
    </Page>
  );
}
