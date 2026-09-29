import { uiText } from "../../lib/uiText";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { useCamera, cameraMessages } from "../../hooks/useCamera";
import {
  useRecognition,
  type RecognitionConfig,
} from "../../hooks/useRecognition";
import { useGestureLibrary } from "../../services/gestureLibrary";
import { useSettings } from "../../services/settingsService";
import {
  recognitionTolerance,
} from "../../services/gestureLibrary";
import { feedback } from "../../lib/feedback";
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
}: {
  gesture: Gesture;
  onAccept(attempt: GestureAttempt): void;
  transitioning: boolean;
  countdown?: number;
  paused: boolean;
  targetKey?: string | number;
  exercise?: "hand-visibility";
}) {
  const camera = useCamera();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [modal, setModal] = useState<"skip" | null>(null);
  const settings = useSettings();
  const vision = useGestureLibrary(!exercise);
  const context = vision.library;
  const config = useMemo<RecognitionConfig>(
    () => ({
      mode: "real",
      enabled: camera.status === "ready",
      targetKey,
      options: {
        exercise,
        labels: context?.labels ?? {},
        staticModels: context?.staticModels ?? new Map(),
        dynamicModels: context?.dynamicModels ?? new Map(),
        dominantHand: settings.dominantHand,
        tolerance: recognitionTolerance(context),
        customHints: context?.content[gesture.id]?.hints,
      },
    }),
    [context, settings.dominantHand, gesture.id, camera.status, targetKey, exercise],
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
  // Real recognition starts by itself as soon as the camera is ready.
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
      feedback.success(gesture.category === "letter" ? `Буква ${gesture.label}` : gesture.label);
    } else if ((status === "almost" || status === "incorrect") && previous !== "almost" && previous !== "incorrect") {
      feedback.hint();
    }
  }, [status, gesture.category, gesture.label]);
  const failure =
    camera.status !== "loading" && camera.status !== "ready"
      ? cameraMessages[camera.status]
      : null;
  return (
    <>
      <div className="practice-heading">
        <div>
          <span className="eyebrow">{countdown > 0 ? "Следующий жест" : "Показывайте"}</span>
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
          <GestureReference gesture={gesture} />
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
          {!exercise && vision.status === "error" && <div className="notice" role="alert">Не удалось загрузить упражнение <Button variant="secondary" onClick={vision.retry}>Загрузить снова</Button></div>}
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
            <GestureCountdown count={countdown} title={gesture.title} />
          ) : (
            <GestureFeedback result={recognition.result} handVisibility={Boolean(exercise)} />
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
        {!exercise && <Button variant="ghost" disabled={transitioning} onClick={() => setModal("skip")}>Пропустить жест</Button>}
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
