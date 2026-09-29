import { hints } from "../../vision/hints";
import { uiText } from "../../lib/uiText";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Hand, ScanLine, TriangleAlert, X } from "lucide-react";
import type { RecognitionResult } from "../../types/vision";

export function GestureFeedback({
  result,
  handVisibility = false,
}: {
  result: RecognitionResult;
  handVisibility?: boolean;
}) {
  const { status, holdProgress } = result;
  const message = result.message === hints.noSamples()
    ? "Можно пропустить этот жест и продолжить урок"
    : result.message;
  const title =
    status === "success"
      ? "Отлично!"
      : status === "almost"
        ? "Немного не так"
        : status === "incorrect"
          ? "Попробуем ещё раз"
          : status === "environment-error"
            ? "Проверьте положение руки"
            : status === "searching"
              ? "Вижу руку"
              : handVisibility ? "Покажите руку в камеру" : "Покажите жест в камеру";
  const Icon =
    status === "success"
      ? Check
      : status === "almost" || status === "environment-error"
        ? TriangleAlert
        : status === "incorrect"
          ? X
          : status === "searching"
            ? ScanLine
            : Hand;
  return (
    <section className={`feedback-card ${status}`} aria-label="Обратная связь">
      <span className="eyebrow">Подсказка для вас</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="feedback-message"
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <span className="feedback-icon">
            <Icon size={27} aria-hidden="true" />
          </span>
          <div role="status" aria-live="polite" aria-atomic="true">
            <h2>{title}</h2>
            <p>
              {uiText(message ??
                (status === "success"
                  ? "Жест распознан. Переходим дальше"
                  : status === "searching"
                    ? holdProgress > 0
                      ? "Удерживайте жест…"
                      : "Проверяем жест…"
                    : "Расположите руку в центре кадра"))}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
      {holdProgress > 0 && (
        <div className="hold-progress">
          <svg
            viewBox="0 0 48 48"
            role="progressbar"
            aria-label="Удержание жеста"
            aria-valuenow={Math.round(holdProgress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <circle cx="24" cy="24" r="20" className="ring-track" />
            <circle
              cx="24"
              cy="24"
              r="20"
              className="ring-value"
              pathLength="100"
              strokeDasharray={`${holdProgress * 100} 100`}
            />
          </svg>
          <span>{status === "success" ? "Готово" : "Удерживайте"}</span>
        </div>
      )}
      {result.confidence > 0 && status !== "environment-error" && (
        <p className="confidence">
          Сходство с образцом{" "}
          <strong>{Math.round(result.confidence * 100)}%</strong>
        </p>
      )}
    </section>
  );
}

export function GestureCountdown({ count, title }: { count: number; title: string }) {
  return (
    <section className="feedback-card gesture-countdown" aria-label="Подготовка к следующему жесту">
      <span className="eyebrow">Следующий жест</span>
      <h2>{title}</h2>
      <div className="countdown-dial" aria-hidden="true">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" className="ring-track" />
          <circle cx="40" cy="40" r="34" className="ring-value" pathLength="3" strokeDasharray={`${4 - count} 3`} />
        </svg>
        <strong key={count}>{count}</strong>
      </div>
      <p role="status" aria-live="polite">Подготовьте руку<span className="sr-only">. Отсчёт: {count}</span></p>
      <small>Ошибки пока не учитываются</small>
    </section>
  );
}
