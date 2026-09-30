import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, RotateCcw, Star, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useApp } from "../context/appState";
import { useLessons } from "../hooks/useLessons";
import { useCompletionSound } from "../hooks/useCompletionSound";
import { ERROR_LABELS, frequentErrors, isDemoResult, isPassedResult, lessonStatus, progressService } from "../services/progressService";
import { Page } from "../components/layout/Page";
import { ContentState } from "../components/common/ContentState";
import { SectionTitle } from "../components/lessons/SectionTitle";
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
  const passed = result ? isPassedResult(result) : false;
  useCompletionSound(Boolean(result), passed);
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
          <p>Он может быть сохранён в другом браузере или аккаунте</p>
          <Link className="button button--primary" to={ROUTES.dashboard}>
            Вернуться на главную
          </Link>
        </div>
      </Page>
    );
  const currentIndex = lessons.findIndex((item) => item.id === result.lessonId);
  const next = currentIndex >= 0 ? lessons.slice(currentIndex + 1).find(item => item.sectionId === lessons[currentIndex]?.sectionId) : undefined;
  const lesson = lessons[currentIndex];
  const isDemo = isDemoResult(result);
  const nextAvailable = passed && next && lessonStatus(next, lessons, progress) !== "locked";
  const errors = frequentErrors(result.attempts).filter(({ label }) => label !== ERROR_LABELS.LOW_LIGHT);
  const seconds = Math.floor(result.durationMs / 1000);
  const assessed = result.attempts.filter((attempt) => attempt.assessed !== false);
  const unassessedCount = result.attempts.length - assessed.length;
  return (
    <Page>
      <section className="results-screen">
        {passed ? (
          <span className="result-check result-celebrate">
            <Check size={28} />
          </span>
        ) : (
          <span className="result-check result-check--failed">
            <X size={28} aria-hidden="true" />
          </span>
        )}
        <span className="eyebrow">
          {lesson ? <><SectionTitle sectionId={lesson.sectionId} /> · Урок {lesson.number}</> : "Сохранённый результат"}
        </span>
        <h1>{passed ? "Урок завершён" : "Урок не пройден — попробуйте ещё раз"}</h1>
        {isDemo && <p className="notice">Этот результат не влияет на очки и прогресс обучения</p>}
        {passed && <p>
          {lesson?.personalized === "name" && lesson.spelledName && lesson.spelledName.letters.length >= 2
            ? "Вы показали своё имя на жестовом языке!"
            : "Ещё один шаг к пониманию друг друга"}
        </p>}
        <div
          className="result-stars"
          role="img"
          aria-label={`${result.stars} из 3 звёзд`}
        >
          {!reduced && passed && <span className="result-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--angle": `${index * 30}deg`, "--reach": `${70 + index % 3 * 15}px` } as CSSProperties} />)}</span>}
          {[1, 2, 3].map((star) => (
            <motion.span
              aria-hidden="true"
              key={star}
              initial={reduced ? false : { opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduced ? 0 : 0.35 + star * 0.15, duration: 0.3 }}
            >
              <Star
                size={44}
                className={star <= result.stars ? "earned" : ""}
                fill={star <= result.stars ? "currentColor" : "none"}
              />
            </motion.span>
          ))}
        </div>
        <motion.div className="result-stats card" initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : 1.05, duration: 0.35 }}>
          {assessed.length ? (
            <div>
              <strong>{result.accuracy}%</strong>
              <span>Точность</span>
            </div>
          ) : (
            <div>
              <strong><Check size={32} aria-hidden="true" /></strong>
              <span>Урок изучен</span>
            </div>
          )}
          <div>
            <ScoreReveal score={result.score} />
            <span>Очки</span>
          </div>
          {assessed.length ? (
            <div>
              <strong>
                {assessed.filter((attempt) => attempt.success).length} /{" "}
                {assessed.length}
              </strong>
              <span>Правильные жесты</span>
            </div>
          ) : (
            <div>
              <strong>{unassessedCount}</strong>
              <span>Изучено без оценки</span>
            </div>
          )}
        </motion.div>
        {assessed.length > 0 && unassessedCount > 0 && (
          <p className="result-time">Изучено без оценки: {unassessedCount}</p>
        )}
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
                ? "Жесты пропущены. Повторите урок, чтобы потренироваться"
                : "Нет ошибок для разбора"}
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
          ) : !passed && lesson ? (
            <Link
              className="button button--primary"
              to={ROUTES.lesson(result.lessonId)}
            >
              <RotateCcw size={17} />
              Пройти ещё раз
            </Link>
          ) : !next && !isDemo && lesson ? (
            <p className="notice">
              Вы прошли раздел! Можно повторить любой урок на
              дорожке
            </p>
          ) : null}
          {passed && lesson && (
            <Link
              className="button button--secondary"
              to={ROUTES.lesson(result.lessonId)}
            >
              <RotateCcw size={17} />
              Повторить урок
            </Link>
          )}
          <Link className="text-link" to={ROUTES.dashboard}>
            Вернуться на главную
          </Link>
        </div>
      </section>
    </Page>
  );
}
