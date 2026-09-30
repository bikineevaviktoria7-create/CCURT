import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Camera, CameraOff } from "lucide-react";
import { ROUTES } from "../../app/constants";
import { uiText } from "../../lib/uiText";
import { useCamera, CAMERA_MESSAGES } from "../../hooks/useCamera";
import { useRecognition, type RecognitionConfig } from "../../hooks/useRecognition";
import { recognitionTolerance, useGestureLibrary } from "../../services/gestureLibrary";
import { useSettings } from "../../services/settingsService";
import { soundFeedback } from "../../lib/soundFeedback";
import { GestureReference } from "../lessons/GestureReference";
import { GestureCountdown, GestureFeedback } from "../feedback/GestureFeedback";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import type { Gesture } from "../../types/lesson";
import type { GestureAttempt } from "../../types/progress";

export function PracticeGesture({
  gesture,
  onAccept,
  transitioning,
  countdown = 0,
  paused,
  targetKey,
  exercise,
  onCameraReady,
}: {
  gesture: Gesture;
  onAccept(attempt: GestureAttempt): void;
  transitioning: boolean;
  countdown?: number;
  paused: boolean;
  targetKey?: string | number;
  exercise?: "hand-visibility";
  onCameraReady?: (ready: boolean) => void;
}) {
  const camera = useCamera();
  // Отсчёт ждёт только загрузку камеры: при отказе или ошибке урок идёт дальше, чтобы работали «Пропустить» и «Дальше».
  useEffect(() => { onCameraReady?.(camera.status !== "loading"); }, [camera.status, onCameraReady]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [modal, setModal] = useState<"skip" | null>(null);
  const settings = useSettings();
  const gestureLibrary = useGestureLibrary(!exercise);
  const library = gestureLibrary.library;
  const config = useMemo<RecognitionConfig>(
    () => ({
      mode: "real",
      enabled: camera.status === "ready",
      targetKey,
      options: {
        exercise,
        labels: library?.labels ?? {},
        staticModels: library?.staticModels ?? new Map(),
        dominantHand: settings.dominantHand,
        tolerance: recognitionTolerance(library),
        customHints: library?.content[gesture.id]?.hints,
      },
    }),
    [library, settings.dominantHand, gesture.id, camera.status, targetKey, exercise],
  );
  const recognition = useRecognition(
    gesture,
    camera.videoRef,
    canvas,
    onAccept,
    paused || transitioning || countdown > 0 || modal !== null,
    config,
  );
  const { start, running, modelError } = recognition;
  // Распознавание запускается само, как только камера готова.
  useEffect(() => {
    if (camera.status === "ready" && !running && !modelError) start();
  }, [camera.status, running, modelError, start]);
  const status = recognition.result.status;
  const previousSoundStatus = useRef(status);
  useEffect(() => {
    const previous = previousSoundStatus.current;
    previousSoundStatus.current = status;
    if (status === previous) return;
    if (status === "success") {
      soundFeedback.success(gesture.category === "letter" ? `Буква ${gesture.label}` : gesture.label);
    } else if ((status === "almost" || status === "incorrect") && previous !== "almost" && previous !== "incorrect") {
      soundFeedback.hint();
    }
  }, [status, gesture.category, gesture.label]);
  // Без эталонов жест урока изучается по образцу и не оценивается.
  const studyOnly = !exercise && gestureLibrary.status === "ready" && !recognition.available;
  const failure =
    camera.status !== "loading" && camera.status !== "ready"
      ? CAMERA_MESSAGES[camera.status]
      : null;
  return (
    <>
      <div className="practice-heading">
        <div>
          <span className="eyebrow">{countdown > 0 ? "Подготовка к жесту" : "Показывайте"}</span>
          <h1>
            {exercise ? "Удержите руку в кадре" : "Покажите "}
            {!exercise && (gesture.category === "letter"
              ? `букву ${gesture.label}`
              : `"${gesture.label}"`)}
          </h1>
        </div>
      </div>
      <div className="practice-grid">
        <aside className="target-card card">
          <span className="eyebrow">{exercise ? "Ваша задача" : "Ваш жест"}</span>
          <h2>{gesture.title}</h2>
          <GestureReference gesture={gesture} showPositionOnly={!studyOnly} />
        </aside>
        <section className="camera-section" aria-label="Камера и схема руки">
          <div className={`camera-frame ${recognition.result.status}`}>
            <video
              ref={camera.videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Зеркальное изображение с камеры"
            />
            <canvas
              ref={canvas}
              aria-label="Скелет обнаруженной руки и подсветка ошибок"
            />
            <span className="camera-badge">
              <Camera size={14} />
              {camera.status === "ready"
                ? "Камера активна"
                : "Камера выключена"}
            </span>
            <span className="safe-zone" aria-hidden="true" />
            {(camera.status !== "ready" || !recognition.running) && (
              <div
                className={`camera-center ${camera.status === "ready" ? "is-ready" : ""}`}
              >
                {camera.status === "loading" ? (
                  <>
                    <Camera size={36} />
                    <h2>Подготавливаем камеру</h2>
                    <p>Разрешите доступ в браузере</p>
                  </>
                ) : failure ? (
                  <>
                    <CameraOff size={36} />
                    <h2>{failure.title}</h2>
                    <p>{uiText(failure.message)}</p>
                    <Button
                      variant="secondary"
                      onClick={() => void camera.start()}
                    >
                      Попробовать снова
                    </Button>
                  </>
                ) : (
                  <>
                    <Camera size={36} />
                    <h2>Камера готова</h2>
                    <p>Поместите руку в центр кадра</p>
                  </>
                )}
              </div>
            )}
          </div>
          {!exercise && gestureLibrary.status === "error" && <div className="notice" role="alert">Не удалось загрузить упражнение <Button variant="secondary" onClick={gestureLibrary.retry}>Загрузить снова</Button></div>}
          {recognition.modelLoading && camera.status === "ready" && <p role="status">Подготавливаем упражнение…</p>}
          {recognition.modelError && (
            <div className="notice" role="alert">
              Не удалось запустить распознавание. Попробуйте снова{" "}
              <Button variant="secondary" onClick={recognition.start}>
                Повторить
              </Button>{" "}

            </div>
          )}
        </section>
        <aside className="feedback-column">
          {countdown > 0 ? (
            <GestureCountdown count={camera.status === "ready" ? countdown : 0} title={gesture.title} />
          ) : studyOnly ? (
            <section className="feedback-card" aria-label="Обратная связь">
              <span className="eyebrow">Подсказка для вас</span>
              <div className="feedback-message">
                <span className="feedback-icon">
                  <BookOpen size={27} aria-hidden="true" />
                </span>
                <div role="status" aria-live="polite" aria-atomic="true">
                  <h2>Жест для изучения</h2>
                  <p>Автоматическая оценка для этого жеста пока недоступна — повторите его по эталону</p>
                </div>
              </div>
            </section>
          ) : (
            <>
              <GestureFeedback result={recognition.presentation.current} handVisibilityCheck={Boolean(exercise)} />
              {recognition.presentation.history.length > 0 && <div className="feedback-history" aria-label="История подсказок">
                {recognition.presentation.history.map(item => <GestureFeedback key={item.key} result={item.result} compact corrected={item.corrected} />)}
              </div>}
            </>
          )}
          {recognition.result.referenceIssue && !studyOnly &&
            <Link className="text-link" to={ROUTES.dashboard}>Вернуться к урокам</Link>}
          {import.meta.env.DEV && new URLSearchParams(window.location.search).has("visionDebug") && (
            <details className="recognition-diagnostics">
              <summary>Диагностика распознавания</summary>
              <pre>{JSON.stringify({ phase: countdown ? "countdown" : recognition.result.status,
                target: gesture.label, predicted: recognition.result.predictedLabel,
                referenceIssue: recognition.result.referenceIssue,
                ...recognition.result.diagnostics, confidence: recognition.result.confidence,
                holdProgress: recognition.result.holdProgress, errorCodes: recognition.result.errorCodes,
              }, null, 2)}</pre>
            </details>
          )}
          <p className="feedback-note">
            Одна подсказка за раз.
            <br />
            Не торопитесь – у вас получится
          </p>
        </aside>
      </div>
      <div className="practice-controls">
        <div className="practice-instruction">
          <p>{exercise ? "Держите руку полностью в кадре" : "Не торопитесь и держите руку в кадре"}</p>
        </div>
        {studyOnly ? (
          <Button
            disabled={transitioning}
            onClick={() => {
              recognition.stop();
              onAccept(recognition.studiedAttempt());
            }}
          >
            Дальше
          </Button>
        ) : !exercise && <Button variant="ghost" disabled={transitioning} onClick={() => setModal("skip")}>Пропустить жест</Button>}
      </div>
      {modal === "skip" && (
        <Modal title="Пропустить этот жест?" onClose={() => setModal(null)}>
          <p>
            Он будет отмечен как ошибка. Вы сможете повторить его после занятия
          </p>
          <div className="action-row">
            <Button
              variant="danger"
              onClick={() => {
                recognition.stop();
                onAccept(recognition.skippedAttempt());
                setModal(null);
              }}
            >
              Пропустить
            </Button>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Отмена
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
