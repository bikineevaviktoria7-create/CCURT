import { useRef, useState } from "react";
import { Camera, CameraOff, Expand, ShieldCheck } from "lucide-react";
import { useCamera, cameraMessages } from "../../hooks/useCamera";
import { useRecognition } from "../../hooks/useRecognition";
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
}: {
  gesture: Gesture;
  onAccept(attempt: GestureAttempt): void;
  transitioning: boolean;
  paused: boolean;
}) {
  const camera = useCamera();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [modal, setModal] = useState<"skip" | "reference" | null>(null);
  const recognition = useRecognition(
    gesture,
    camera.videoRef,
    canvas,
    onAccept,
    paused || modal !== null,
  );
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
            Покажите{" "}
            {gesture.category === "letter"
              ? `букву ${gesture.label}`
              : `«${gesture.label}»`}
          </h1>
        </div>
        <span className="demo-badge">Демонстрация распознавания</span>
      </div>
      <div className="practice-grid">
        <aside className="target-card card">
          <span className="eyebrow">Ваш жест</span>
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
              aria-label="Схема подсветки руки в демонстрации, не эталон РЖЯ"
            />
            <span className="camera-badge">
              <Camera size={14} />
              {camera.status === "ready"
                ? "Камера активна"
                : "Камера выключена"}
            </span>
            <span className="safe-zone" aria-hidden="true" />
            {!recognition.running && (
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
            {recognition.running && (
              <span className="camera-caption">
                Схема подсветки · не эталон жеста
              </span>
            )}
          </div>
          <p className="privacy">
            <ShieldCheck size={16} />
            Изображение с камеры не отправляется на сервер.
          </p>
          {recognition.modelError && (
            <div className="notice" role="alert">
              Не удалось запустить распознавание.{" "}
              <Button variant="secondary" onClick={recognition.start}>
                Повторить
              </Button>
            </div>
          )}
        </section>
        <aside className="feedback-column">
          <GestureFeedback result={recognition.result} />
          <p className="feedback-note">
            Одна подсказка за раз.
            <br />
            Не торопитесь — у вас получится.
          </p>
        </aside>
      </div>
      <div className="practice-controls">
        <div className="demo-controls">
          <p>
            Реальное распознавание ещё не подключено. Демо показывает подсказку,
            исправление и успех по сценарию.
          </p>
          {!recognition.running && (
            <Button onClick={recognition.start}>Запустить демонстрацию</Button>
          )}
        </div>
        <Button
          variant="ghost"
          disabled={transitioning}
          onClick={() => setModal("skip")}
        >
          Пропустить жест
        </Button>
      </div>
      {import.meta.env.DEV && recognition.running && (
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
