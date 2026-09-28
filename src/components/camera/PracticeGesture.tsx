import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Expand, ShieldCheck } from "lucide-react";
import { useCamera, cameraMessages } from "../../hooks/useCamera";
import {
  useRecognition,
  type RecognitionConfig,
} from "../../hooks/useRecognition";
import { useGestureLibrary } from "../../services/gestureLibrary";
import { useSettings } from "../../services/settingsService";
import {
  recognitionTolerance,
  visionMode,
} from "../../services/gestureLibrary";
import { hasModel } from "../../vision/recognizer";
import { feedback } from "../../lib/feedback";
import { GestureReference } from "../lessons/GestureReference";
import { GestureFeedback } from "../feedback/GestureFeedback";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import type { Gesture } from "../../types/lesson";
import type { GestureAttempt } from "../../types/progress";
import type { RecognitionStatus } from "../../types/vision";

export function PracticeGesture({
  gesture,
  onAccept,
  transitioning,
  paused,
  targetKey,
  exercise,
}: {
  gesture: Gesture;
  onAccept(attempt: GestureAttempt): void;
  transitioning: boolean;
  paused: boolean;
  targetKey?: string | number;
  exercise?: "hand-visibility";
}) {
  const camera = useCamera();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [modal, setModal] = useState<"skip" | "reference" | null>(null);
  const [forceDemo, setForceDemo] = useState(false);
  const settings = useSettings();
  const vision = useGestureLibrary(!exercise);
  const context = vision.library;
  const hasSamples = Boolean(
    context &&
      hasModel({
        targetId: gesture.id,
        targetKind: gesture.kind,
        staticModels: context.staticModels,
        dynamicModels: context.dynamicModels,
      }),
  );
  const config = useMemo<RecognitionConfig>(
    () => ({
      mode: import.meta.env.DEV && !exercise && (forceDemo || visionMode === "mock") ? "demo" : "real",
      enabled: camera.status === "ready" || (import.meta.env.DEV && !exercise && forceDemo),
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
    [forceDemo, context, settings.dominantHand, gesture.id, camera.status, targetKey, exercise],
  );
  const demo = config.mode === "demo";
  const recognition = useRecognition(
    gesture,
    camera.videoRef,
    canvas,
    onAccept,
    paused || modal !== null,
    config,
  );
  const { start, running, modelError } = recognition;
  // Real recognition starts by itself as soon as the camera is ready.
  useEffect(() => {
    if (!demo && camera.status === "ready" && !running && !modelError) start();
  }, [demo, camera.status, running, modelError, start]);
  const status = recognition.result.status;
  const message = recognition.result.message;
  useEffect(() => {
    if (status === "success")
      feedback.success(gesture.category === "letter" ? `Буква ${gesture.label}` : gesture.label);
  }, [status, gesture.category, gesture.label]);
  useEffect(() => {
    if ((status === "almost" || status === "incorrect") && message) feedback.hint();
  }, [status, message]);
  const failure =
    camera.status !== "loading" && camera.status !== "ready"
      ? cameraMessages[camera.status]
      : null;
  return (
    <>
      <div className="practice-heading">
        <div>
          <span className="eyebrow">Практика</span>
          <h1>
            {exercise ? "Удержите руку в кадре" : "Покажите "}
            {!exercise && (gesture.category === "letter"
              ? `букву ${gesture.label}`
              : `«${gesture.label}»`)}
          </h1>
        </div>
        {demo && <span className="demo-badge">Демонстрация распознавания</span>}
      </div>
      <div className="practice-grid">
        <aside className="target-card card">
          <span className="eyebrow">{exercise ? "Ваша задача" : "Ваш жест"}</span>
          <h2>{gesture.title}</h2>
          <GestureReference gesture={gesture} />
          <button
            className="text-link"
            disabled={transitioning}
            onClick={() => setModal("reference")}
          >
            <Expand size={15} />
            Посмотреть ещё раз
          </button>
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
                    <p>Разрешите доступ в браузере.</p>
                  </>
                ) : failure ? (
                  <>
                    <CameraOff size={36} />
                    <h2>{failure.title}</h2>
                    <p>{failure.message}</p>
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
                    <p>Поместите руку в центр кадра.</p>
                  </>
                )}
              </div>
            )}
            {recognition.running && camera.status === "ready" && (
              <span className="camera-caption">
                {demo
                  ? "Схема подсветки · не эталон жеста"
                  : "Распознавание работает на вашем устройстве"}
              </span>
            )}
          </div>
          <p className="privacy">
            <ShieldCheck size={16} />
            Изображение с камеры не отправляется на сервер.
          </p>
          {!exercise && vision.status === "error" && <div className="notice" role="alert">Не удалось загрузить эталоны. <Button variant="secondary" onClick={vision.retry}>Загрузить снова</Button></div>}
          {recognition.modelLoading && camera.status === "ready" && <p role="status">Загружаем распознавание…</p>}
          {recognition.modelError && (
            <div className="notice" role="alert">
              Не удалось запустить распознавание. Попробуйте снова.{" "}
              <Button variant="secondary" onClick={recognition.start}>
                Повторить
              </Button>{" "}

            </div>
          )}
        </section>
        <aside className="feedback-column">
          <GestureFeedback result={recognition.result} demo={demo} handVisibility={Boolean(exercise)} />
          <p className="feedback-note">
            Одна подсказка за раз.
            <br />
            Не торопитесь — у вас получится.
          </p>
        </aside>
      </div>
      <div className="practice-controls">
        <div className="demo-controls">
          <p>{exercise ? "Тест обнаружения руки. Он не оценивает правильность жеста РЖЯ."
            : vision.status === "loading" ? "Загружаем эталоны жестов…"
            : !hasSamples ? "Проверенные эталоны этого жеста ещё не добавлены. Камера показывает руку, оценка жеста недоступна."
            : "Держите руку полностью в кадре и сравнивайте с эталоном."}</p>
          {import.meta.env.DEV && !exercise && (
            <>
              <Button variant="secondary" onClick={() => setForceDemo(!forceDemo)}>
                {forceDemo ? "Вернуться к камере" : "Симулятор · разработка"}
              </Button>
              {demo && !recognition.running && <Button onClick={recognition.start}>Запустить демонстрацию</Button>}
            </>
          )}
        </div>
        {!exercise && <Button variant="ghost" disabled={transitioning} onClick={() => setModal("skip")}>Пропустить жест</Button>}
      </div>
      {import.meta.env.DEV && recognition.running && recognition.canSimulate && (
        <details className="dev-panel">
          <summary>Симулятор состояний · разработка</summary>
          <div className="dev-actions">
            {(
              [
                ["idle", "Ожидание"],
                ["searching", "Распознавание"],
                ["almost", "Почти"],
                ["incorrect", "Ошибка"],
                ["environment-error", "Рука вне кадра"],
                ["success", "Успех"],
              ] as const
            ).map(([status, label]) => (
              <button
                disabled={transitioning}
                key={status}
                onClick={() =>
                  recognition.simulate(
                    status as RecognitionStatus,
                    status === "success" ? 0.92 : 0.7,
                    status === "success" ? 1 : 0,
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Сходство
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(recognition.result.confidence * 100)}
              disabled={transitioning}
              onChange={(event) =>
                recognition.simulate(
                  recognition.result.status,
                  Number(event.target.value) / 100,
                  recognition.result.holdProgress,
                )
              }
            />
          </label>
          <label>
            Удержание
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(recognition.result.holdProgress * 100)}
              disabled={transitioning}
              onChange={(event) =>
                recognition.simulate(
                  "searching",
                  recognition.result.confidence,
                  Number(event.target.value) / 100,
                )
              }
            />
          </label>
        </details>
      )}
      {modal === "reference" && (
        <Modal title={gesture.title} onClose={() => setModal(null)}>
          <GestureReference gesture={gesture} />
          <p>{gesture.description}</p>
          <Button onClick={() => setModal(null)}>Продолжить практику</Button>
        </Modal>
      )}
      {modal === "skip" && (
        <Modal title="Пропустить этот жест?" onClose={() => setModal(null)}>
          <p>
            Он будет отмечен как ошибка. Вы сможете повторить его после занятия.
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
