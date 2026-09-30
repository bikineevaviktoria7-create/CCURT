import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PLACEHOLDER_DESCRIPTION } from "../data/alphabet";
import { uiText } from "../lib/uiText";
import { useRouteLesson } from "../hooks/useRouteLesson";
import { useLessonSession } from "../hooks/useLessonSession";
import { useApp } from "../context/appState";
import { lessonStatus } from "../services/progressService";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { ContentState } from "../components/common/ContentState";
import { GestureReference } from "../components/lessons/GestureReference";
import { SectionTitle } from "../components/lessons/SectionTitle";
import { PracticeGesture } from "../components/camera/PracticeGesture";
import { ROUTES } from "../app/constants";
import type { Lesson } from "../types/lesson";
import type { LessonResult } from "../types/progress";

function CompletedLesson({ getResult }: { getResult(): LessonResult }) {
  const [result] = useState(getResult);
  const { complete } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    complete(result);
    navigate(ROUTES.results(result.sessionId), { replace: true });
  }, [complete, result, navigate]);
  return (
    <p className="content-state" role="status">
      Сохраняем результат…
    </p>
  );
}

function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [exitRequested, setExitRequested] = useState(false);
  const session = useLessonSession(lesson, exitRequested);
  const { state } = session;
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const main = useRef<HTMLElement>(null);
  const theory = state.phase === "learn";
  const theoryList = lesson.theoryGestures ?? lesson.gestures;
  const list = theory ? theoryList : lesson.gestures;
  const gesture = list[state.currentGestureIndex];
  const total = list.length;
  const ready = state.phase === "ready";
  const practicing = state.phase === "practice";
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [state.currentGestureIndex, practicing]);
  if (state.phase === "completed")
    return <CompletedLesson getResult={session.result} />;
  if (!gesture) return <ContentState status="missing" />;
  return (
    <div className="lesson-player">
      <div className="lesson-nav-area">
      <header className="lesson-topbar">
        <button
          className="icon-button"
          aria-label="Выйти из урока"
          onClick={() => setExitRequested(true)}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="lesson-topbar-title">
          <strong>
            <SectionTitle sectionId={lesson.sectionId} /> ·
            Урок {lesson.number}
          </strong>
          <span>{theory || ready ? "Изучение жестов" : "Практика"}</span>
        </div>
        <div className="lesson-progress">
          <div className="segments" aria-hidden="true">
            {list.map((item, index) => (
              <span
                key={`${item.id}-${index}`}
                className={
                  ready ||
                  (theory
                    ? index < state.currentGestureIndex
                    : Boolean(state.attempts[index]?.success) ||
                      state.attempts[index]?.assessed === false)
                    ? "done"
                    : state.attempts[index]?.skipped
                      ? "skipped"
                      : index === state.currentGestureIndex
                        ? "active"
                        : ""
                }
              />
            ))}
          </div>
          <span aria-label="Прогресс урока">
            {ready ? theoryList.length : state.currentGestureIndex + 1} /{" "}
            {ready ? theoryList.length : total}
          </span>
        </div>
      </header>
      </div>
      <main ref={main} tabIndex={-1} className="lesson-main">
        {theory ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              className="learn-screen"
              key={`${gesture.id}-${state.currentGestureIndex}`}
              initial={reduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="learn-intro">
                <span className="eyebrow">
                  Знакомимся с жестами · {state.currentGestureIndex + 1} из{" "}
                  {total}
                </span>
                <h1>{gesture.title}</h1>
                <p>
                  Посмотрите эталон и описание. Практика начнётся, когда вы
                  изучите все жесты урока
                </p>
              </div>
              <div className="learn-card card">
                <GestureReference gesture={gesture} />
                <div className="learn-description">
                  <span className="eyebrow">Как выполнить</span>
                  <h2>{gesture.title}</h2>
                  {gesture.description !== PLACEHOLDER_DESCRIPTION && <p>{uiText(gesture.description)}</p>}
                  <Button onClick={session.nextTheory}>
                    Далее
                    <ArrowRight size={19} />
                  </Button>
                </div>
              </div>
            </motion.section>
          </AnimatePresence>
        ) : ready ? (
          <section className="practice-ready">
            <span className="ready-icon">
              <Camera size={34} />
            </span>
            <span className="eyebrow">
              Просмотрено жестов: {theoryList.length} из {theoryList.length}
            </span>
            <h1>Теперь попробуйте сами</h1>
            <p>
              Покажите жесты по порядку:
              <br />
              <strong>
                {lesson.gestures.map((item) => item.label).join(" → ")}
              </strong>
            </p>
            <div className="ready-check">
              <Check size={18} />
              Теория завершена
            </div>
            <Button onClick={session.startPractice}>
              Начать практику
              <ArrowRight size={19} />
            </Button>
            <p className="privacy">
              На следующем экране браузер попросит доступ к камере
            </p>
          </section>
        ) : (
          <PracticeGesture
            gesture={gesture}
            targetKey={state.currentGestureIndex}
            onAccept={session.accept}
            onCameraReady={session.setCameraReady}
            transitioning={state.phase === "transition" || state.phase === "prepare"}
            countdown={state.phase === "prepare" ? state.countdown : 0}
            paused={exitRequested}
          />
        )}
      </main>
      {exitRequested && (
        <Modal title="Выйти из урока?" onClose={() => setExitRequested(false)}>
          <p>
            Завершённые уроки сохранятся. Это занятие в следующий раз начнётся с
            изучения жестов
          </p>
          <div className="action-row">
            <Button variant="secondary" onClick={() => setExitRequested(false)}>
              Продолжить урок
            </Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.dashboard)}>
              Выйти на главную
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function LessonPage() {
  const { lesson, lessons, status, retry, progress } = useRouteLesson();
  if (status !== "ready")
    return (
      <Page>
        <ContentState status={status} retry={retry} />
      </Page>
    );
  if (lesson?.needsName)
    return <Navigate to={ROUTES.lesson(lesson.id)} replace />;
  if (!lesson || lessonStatus(lesson, lessons, progress) === "locked")
    return (
      <Page>
        <ContentState status={lesson ? "locked" : "missing"} />
        <Link to={ROUTES.dashboard} className="text-link">
          На главную
        </Link>
      </Page>
    );
  return <LessonPlayer key={lesson.id} lesson={lesson} />;
}
