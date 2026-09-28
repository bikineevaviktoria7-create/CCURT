import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, RotateCcw, Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useApp } from "../context/appState";
import { useLessons } from "../hooks/useLessons";
import { frequentErrors, isDemoResult, lessonStatus, progressService } from "../services/progressService";
import { feedback } from "../lib/feedback";
import { Page } from "../components/layout/Page";
import { ContentState } from "../components/common/ContentState";
import { ROUTES } from "../app/constants";

function ScoreReveal({ score }: { score: number }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? score : 0);
  useEffect(() => {
    if (reduced) {
      setValue(score);
      return;
    }
    const start = performance.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / 1000);
      setValue(Math.round(score * (1 - Math.pow(1 - progress, 3))));
      if (progress === 1) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [score, reduced]);
  return (
    <strong>
      <span className="sr-only">{score}</span>
      <span aria-hidden="true">{value}</span>
    </strong>
  );
}

export function ResultsPage() {
  const { sessionId } = useParams();
  const { user, progress } = useApp();
  const { lessons, status, retry } = useLessons();
  const reduced = useReducedMotion();
  const result = progress.sessions.find((item) => item.sessionId === sessionId) ??
    (user && sessionId ? progressService.getResult(user.id, sessionId) : undefined);
  const found = Boolean(result);
  useEffect(() => {
    if (found) feedback.lessonComplete();
  }, [found]);
  if (status !== "ready")
    return (
      <Page>
        <ContentState status={status} retry={retry} />
      </Page>
    );
  if (!result)
    return (
      <Page>
        <div className="content-state">
          <h1>Результат не найден</h1>
          <p>Он может быть сохранён в другом браузере или аккаунте.</p>
          <Link className="button button--primary" to={ROUTES.dashboard}>
            Вернуться на главную
          </Link>
        </div>
      </Page>
    );
  const currentIndex = lessons.findIndex((item) => item.id === result.lessonId);
  const next = currentIndex >= 0 ? lessons[currentIndex + 1] : undefined;
  const lesson = lessons[currentIndex];
  const demo = isDemoResult(result);
  const nextAvailable = next && lessonStatus(next, lessons, progress) !== "locked";
  const errors = frequentErrors(result.attempts);
  const seconds = Math.floor(result.durationMs / 1000);
  return (
    <Page>
      <section className="results-screen">
        <span className="result-check">
          <Check size={28} />
        </span>
        <span className="eyebrow">
          {lesson?.sectionId === "alphabet" ? "Алфавит" : "Основные слова"} ·
          Урок {lesson?.number}
        </span>
        <h1>Урок завершён</h1>
        {demo && <p className="notice">Результат демонстрации: очки, статистика и прогресс обучения не изменились.</p>}
        <p>
          {lesson?.personalized === "name" && lesson.spelledName && lesson.spelledName.letters.length >= 2
            ? "Вы показали своё имя на жестовом языке!"
            : "Ещё один шаг к пониманию друг друга."}
        </p>
        <div
          className="result-stars"
          role="img"
          aria-label={`${result.stars} из 3 звёзд`}
        >
          {[1, 2, 3].map((star) => (
            <motion.span
              aria-hidden="true"
              key={star}
              initial={reduced ? false : { opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduced ? 0 : star * 0.15, duration: 0.25 }}
            >
              <Star
                size={44}
                className={star <= result.stars ? "earned" : ""}
                fill={star <= result.stars ? "currentColor" : "none"}
              />
            </motion.span>
          ))}
        </div>
        <div className="result-stats card">
          <div>
            <strong>{result.accuracy}%</strong>
            <span>Точность</span>
          </div>
          <div>
            <ScoreReveal score={result.score} />
            <span>Очки</span>
          </div>
          <div>
            <strong>
              {result.attempts.filter((attempt) => attempt.success).length} /{" "}
              {result.attempts.length}
            </strong>
            <span>Правильные жесты</span>
          </div>
        </div>
        <p className="result-time">
          Время занятия: {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </p>
        <div className="frequent-errors card">
          <h2>Частые ошибки</h2>
          {errors.length ? (
            <ul>
              {errors.map(({ label, count }) => (
                <li key={label}>
                  <span>{label}</span>
                  <strong>
                    {count} {count === 1 ? "раз" : count < 5 ? "раза" : "раз"}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {result.attempts.some((item) => item.skipped)
                ? "Жесты пропущены. Повторите урок, чтобы потренироваться."
                : "В этом занятии ошибки не отмечены."}
            </p>
          )}
        </div>
        <div className="result-actions">
          {next && nextAvailable ? (
            <Link
              className="button button--primary"
              to={ROUTES.lesson(next.id)}
            >
              Следующий урок
              <ArrowRight size={18} />
            </Link>
          ) : !next && !demo ? (
            <p className="notice">
              Вы прошли все {lessons.length} уроков! Можно повторить любой на
              дорожке.
            </p>
          ) : null}
          <Link
            className="button button--secondary"
            to={ROUTES.lesson(result.lessonId)}
          >
            <RotateCcw size={17} />
            Повторить урок
          </Link>
          <Link className="text-link" to={ROUTES.dashboard}>
            Вернуться на главную
          </Link>
        </div>
      </section>
    </Page>
  );
}
