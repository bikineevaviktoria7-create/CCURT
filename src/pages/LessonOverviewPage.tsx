import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import { uiText } from "../lib/uiText";
import { Button } from "../components/common/Button";
import { settingsService } from "../services/settingsService";
import { NAME_PATTERN } from "../lib/nameLesson";
import { Page } from "../components/layout/Page";
import { ContentState } from "../components/common/ContentState";
import { GestureReference } from "../components/lessons/GestureReference";
import { SectionTitle } from "../components/lessons/SectionTitle";
import { useRouteLesson } from "../hooks/useRouteLesson";
import { useApp } from "../context/appState";
import { lessonStatus } from "../services/progressService";
import { ROUTES } from "../app/constants";
import type { Lesson } from "../types/lesson";

function NameStep({ lesson }: { lesson: Lesson }) {
  const { user } = useApp();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const spelled = lesson.spelledName;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!NAME_PATTERN.test(value)) {
      setError("Напишите имя русскими буквами, от 2 до 12 букв");
      return;
    }
    if (user) settingsService.setLearnerName(user.id, value);
    setEditing(false);
    setError("");
  }
  if (lesson.needsName || editing)
    return (
      <form className="name-step card form-stack" onSubmit={submit} noValidate>
        <h2>Как вас зовут?</h2>
        <p>
          В конце урока вы покажете своё имя дактилем – буква за буквой.
          Напишите его русскими буквами
        </p>
        <label>
          Имя
          <input
            name="name"
            defaultValue={spelled?.name ? spelled.name.charAt(0) + spelled.name.slice(1).toLowerCase() : ""}
            placeholder="Например, Анна"
            maxLength={12}
            autoComplete="given-name"
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {uiText(error)}
          </p>
        )}
        <Button type="submit">Сохранить имя</Button>
      </form>
    );
  if (!spelled) return null;
  return (
    <div className="name-step card">
      <p>
        Ваше имя дактилем: <strong>{spelled.letters.map((letter) => letter.label).join(" · ") || "–"}</strong>{" "}
        <button className="text-link" onClick={() => setEditing(true)}>
          Изменить
        </button>
      </p>
      {spelled.skipped.length > 0 && (
        <p className="notice">
          В практике будут пропущены буквы: {spelled.skipped.join(", ")}
        </p>
      )}
      {spelled.letters.length < 2 && (
        <p className="notice">
          В этом уроке вы потренируете только слова
        </p>
      )}
    </div>
  );
}

export function LessonOverviewPage() {
  const { lesson, lessons, status, retry, progress } = useRouteLesson();
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
            <SectionTitle sectionId={lesson.sectionId} />
          </p>
          <p className="lesson-number">
            Урок {lesson.number} · {lesson.title}
          </p>
          <h1>
            На этом занятии мы изучим:
          </h1>
          <div className="overview-gestures">
            {(lesson.theoryGestures ?? lesson.gestures).map((gesture) => (
              <div className="overview-gesture" key={gesture.id}>
                <GestureReference gesture={gesture} />
                <h2>{gesture.title}</h2>
              </div>
            ))}
          </div>
          {lesson.personalized === "name" && <NameStep lesson={lesson} />}
          <p className="overview-meta">
            <Clock3 size={18} />
            Около {lesson.estimatedMinutes} минут <span>·</span> Сначала
            изучаем, затем практикуемся
          </p>
          <div className="center-actions">
            {!lesson.needsName && (
              <Link
                className="button button--primary"
                to={ROUTES.play(lesson.id)}
              >
                Начать
                <ArrowRight size={18} />
              </Link>
            )}
            <Link className="text-link" to={ROUTES.dashboard}>
              Вернуться на главную
            </Link>
          </div>
        </section>
      )}
    </Page>
  );
}
