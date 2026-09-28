import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Camera,
  Download,
  ImagePlus,
  Save,
  ScanLine,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { useApp } from "../context/appState";
import { useCamera, cameraMessages } from "../hooks/useCamera";
import { useHandTracking, type TrackedFrame } from "../hooks/useHandTracking";
import { useGestureLibrary } from "../services/gestureLibrary";
import { allGestures } from "../data/lessons";
import { canUseAdmin } from "../services/accessService";
import { captureHandPhoto } from "../lib/capturePhoto";
import {
  gestureRepository,
  type SampleInput,
} from "../services/gestureRepository";
import { settingsService, useSettings } from "../services/settingsService";
import { recognitionTolerance } from "../services/gestureLibrary";
import { extractHandFeatures } from "../vision/features";
import {
  distanceToDynamicModel,
  handLocation,
  motionVector,
  MotionSegmenter,
  resample,
} from "../vision/dynamicMatcher";
import {
  compareStaticGesture,
  distanceToModel,
  rankGestures,
  similarity,
} from "../vision/staticMatcher";
import { analyzeGestureErrors } from "../vision/errorAnalyzer";
import type { Gesture } from "../types/lesson";

const STATIC_SAMPLES = 12;
const STATIC_INTERVAL_MS = 200;
const DYNAMIC_WAIT_MS = 8000;

type Mode = "idle" | "countdown" | "recording" | "review" | "test";

interface TestReadout {
  distance?: number;
  accept?: number;
  similarity?: number;
  ranking: { label: string; distance: number }[];
  hint?: string;
  incorrect?: number[];
  correct?: number[];
  note?: string;
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminPage() {
  const { user } = useApp();
  const isAdmin = user?.role === "admin";
  const allowed = canUseAdmin(user);
  if (!allowed)
    return (
      <Page>
        <div className="content-state">
          <h1>Раздел для администраторов</h1>
          <p>
            Эталоны жестов записывает команда проекта. Войдите в аккаунт с ролью
            администратора.
          </p>
        </div>
      </Page>
    );
  return <AdminWorkspace isAdmin={isAdmin} />;
}

function AdminWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useApp();
  const target = gestureRepository.target(isAdmin);
  const vision = useGestureLibrary();
  const settings = useSettings();
  const [category, setCategory] = useState<"letter" | "word">("letter");
  const [selectedId, setSelectedId] = useState(allGestures[0]?.id ?? "");
  const gesture = allGestures.find((item) => item.id === selectedId) as Gesture;
  const content = vision.library?.content[gesture.id];
  const counts = vision.library?.sampleCounts ?? {};

  const camera = useCamera();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [countdown, setCountdown] = useState(0);
  const countdownTimer = useRef<number | undefined>(undefined);
  const clearCountdown = useCallback(() => {
    window.clearInterval(countdownTimer.current);
    countdownTimer.current = undefined;
  }, []);
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState<SampleInput[]>([]);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [readout, setReadout] = useState<TestReadout | null>(null);
  const [tolerance, setTolerance] = useState(() => recognitionTolerance());

  useEffect(() => {
    setDescription(content?.description ?? "");
  }, [content?.description, gesture.id]);
  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Per-frame recording state lives in a ref: frames never go through React state.
  const recording = useRef({
    samples: [] as SampleInput[],
    lastAt: 0,
    startedAt: 0,
    photoTaken: false,
    wantPhoto: false,
    segmenter: new MotionSegmenter(),
    lastReadout: 0,
    lastProgressAt: 0,
  });

  const reset = useCallback(() => {
    clearCountdown();
    setMode("idle");
    setPending([]);
    setPhoto(null);
    setProgress(0);
    setReadout(null);
  }, [clearCountdown]);
  useEffect(() => {
    reset();
    setMessage("");
    setError("");
    return clearCountdown;
  }, [gesture.id, reset, clearCountdown]);

  const currentGesture = useRef(gesture.id);
  currentGesture.current = gesture.id;
  const takePhoto = useCallback((landmarks: TrackedFrame["hand"]) => {
    const video = camera.videoRef.current;
    if (!video || !landmarks) return;
    const forGesture = currentGesture.current;
    captureHandPhoto(video, landmarks.image).then(
      // Ignore a photo that finishes after the admin switched to another gesture.
      (blob) => currentGesture.current === forGesture && setPhoto(blob),
      () => undefined,
    );
  }, [camera.videoRef]);

  const onFrame = useCallback(
    (frame: TrackedFrame) => {
      const state = recording.current;
      if (state.wantPhoto && frame.hand) {
        state.wantPhoto = false;
        takePhoto(frame.hand);
      }
      if (mode === "recording" && gesture.kind === "static") {
        if (!frame.hand) {
          if (frame.t - state.lastAt > 5000) {
            setMode("idle");
            setError("Рука пропала из кадра. Попробуйте снова.");
          }
          return;
        }
        if (frame.t - state.lastAt < STATIC_INTERVAL_MS) return;
        state.lastAt = frame.t;
        state.samples.push({
          gestureId: gesture.id,
          features: extractHandFeatures(frame.hand.world, frame.hand.hand),
          landmarks: { image: frame.hand.image, world: frame.hand.world },
          handedness: frame.hand.hand,
        });
        if (state.samples.length === Math.ceil(STATIC_SAMPLES / 2) && !state.photoTaken) {
          state.photoTaken = true;
          takePhoto(frame.hand);
        }
        setProgress(state.samples.length / STATIC_SAMPLES);
        if (state.samples.length >= STATIC_SAMPLES) {
          // Copy before clearing: the state updater runs later.
          const collected = state.samples;
          state.samples = [];
          setPending((previous) => [...previous, ...collected]);
          setMode("review");
        }
        return;
      }
      if (mode === "recording" && gesture.kind === "dynamic") {
        const vector = frame.hand
          ? motionVector(
              extractHandFeatures(frame.hand.world, frame.hand.hand),
              handLocation(frame.hand.image, frame.hand.hand, frame.body),
            )
          : undefined;
        const done = state.segmenter.push(vector ? { vector, t: frame.t } : undefined, frame.t);
        if (state.segmenter.recording) {
          if (frame.t - state.lastProgressAt >= 100) {
            state.lastProgressAt = frame.t;
            setProgress(state.segmenter.progress(frame.t));
          }
          if (!state.photoTaken && frame.hand && state.segmenter.progress(frame.t) > 0.2) {
            state.photoTaken = true;
            takePhoto(frame.hand);
          }
        } else if (!done && frame.t - state.startedAt > DYNAMIC_WAIT_MS) {
          setMode("idle");
          setError("Движение не началось. Нажмите «Записать» и сразу покажите жест.");
        }
        if (done) {
          setProgress(1);
          setPending((previous) => [
            ...previous,
            {
              gestureId: gesture.id,
              sequence: resample(done.sequence),
              durationMs: done.durationMs,
              landmarks: [],
              handedness: frame.hand?.hand,
            },
          ]);
          setMode("review");
        }
        return;
      }
      if (mode === "test" && vision.library) {
        if (frame.t - state.lastReadout < 200) return;
        state.lastReadout = frame.t;
        const context = vision.library;
        if (!frame.hand) {
          setReadout({ ranking: [], note: "Рука не видна" });
          return;
        }
        const features = extractHandFeatures(frame.hand.world, frame.hand.hand);
        if (gesture.kind === "static") {
          const model = context.staticModels.get(gesture.id);
          const ranking = rankGestures(features, context.staticModels)
            .slice(0, 3)
            .map((item) => ({ label: context.labels[item.gestureId] ?? item.gestureId, distance: item.distance }));
          if (!model) {
            setReadout({ ranking, note: "У этого жеста нет эталонов" });
            return;
          }
          const decision = compareStaticGesture(features, gesture.id, context.staticModels, tolerance);
          const distance = decision?.distance ?? distanceToModel(features, model);
          const accept = decision?.accept ?? model.acceptDistance * tolerance;
          const analysis = analyzeGestureErrors(features, model);
          const matched = decision?.matched ?? false;
          setReadout({
            distance,
            accept,
            similarity: similarity(distance, accept),
            ranking,
            hint: matched
              ? "Жест засчитан бы ✔"
              : decision?.rival && decision.rival.distance < distance * 0.75
                ? `Ближе к «${context.labels[decision.rival.gestureId] ?? "?"}» — жесты похожи, перезапишите эталоны точнее`
                : analysis.message,
            incorrect: matched ? [] : analysis.incorrectLandmarks,
            correct: analysis.correctLandmarks,
          });
          return;
        }
        const vector = motionVector(features, handLocation(frame.hand.image, frame.hand.hand, frame.body));
        const done = state.segmenter.push({ vector, t: frame.t }, frame.t);
        if (!done) {
          if (state.segmenter.recording) setReadout({ ranking: [], note: "Записываем движение…" });
          return;
        }
        const ranking = [...context.dynamicModels.values()]
          .map((model) => ({
            label: context.labels[model.gestureId] ?? model.gestureId,
            distance: distanceToDynamicModel(done.sequence, model).distance,
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);
        const model = context.dynamicModels.get(gesture.id);
        const distance = model ? distanceToDynamicModel(done.sequence, model).distance : undefined;
        const accept = model ? model.acceptDistance * tolerance : undefined;
        setReadout({
          distance,
          accept,
          similarity: distance !== undefined && accept ? similarity(distance, accept) : undefined,
          ranking,
          note: `Длительность ${(done.durationMs / 1000).toFixed(1)} с`,
        });
      }
    },
    [mode, gesture.id, gesture.kind, vision.library, tolerance, takePhoto],
  );

  const trackingStatus = useHandTracking(
    camera.videoRef,
    canvas,
    camera.status === "ready",
    {
      withPose: gesture.kind === "dynamic",
      dominantHand: settings.dominantHand,
      highlight: mode === "test" ? { incorrect: readout?.incorrect, correct: readout?.correct } : undefined,
    },
    onFrame,
  );

  function startRecording() {
    clearCountdown();
    setError("");
    setMessage("");
    let value = 3;
    setCountdown(value);
    setMode("countdown");
    countdownTimer.current = window.setInterval(() => {
      value -= 1;
      setCountdown(value);
      if (value <= 0) {
        clearCountdown();
        const state = recording.current;
        state.samples = [];
        state.lastAt = 0;
        state.startedAt = performance.now();
        state.lastProgressAt = state.startedAt;
        state.photoTaken = photo !== null;
        state.segmenter.reset();
        setProgress(0);
        setMode("recording");
      }
    }, 800);
  }

  async function run(task: () => Promise<string>) {
    setBusy(true);
    setError("");
    try {
      setMessage(await task());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const saved = pending.length
        ? await gestureRepository.addSamples(target, pending, user?.id)
        : 0;
      if (photo) {
        const imageUrl = await gestureRepository.uploadImage(target, gesture.id, photo);
        await gestureRepository.saveContent(target, { id: gesture.id, description: description || content?.description, imageUrl });
      }
      reset();
      return `Сохранено эталонов: ${saved}${photo ? " · фото обновлено" : ""}.`;
    });

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void run(async () => {
      const bundle: unknown = JSON.parse(await file.text());
      const count = await gestureRepository.importBundle(target, bundle);
      return `Импортировано эталонов: ${count}.`;
    });
  };

  const list = useMemo(
    () => allGestures.filter((item) => item.category === category),
    [category],
  );
  const failure =
    camera.status !== "loading" && camera.status !== "ready"
      ? cameraMessages[camera.status]
      : null;
  const imageSrc = photoUrl ?? content?.imageUrl;

  return (
    <Page>
      <section className="admin">
        <header className="admin-header">
          <div>
            <span className="eyebrow">Админ-панель</span>
            <h1>Эталоны жестов</h1>
            <p>
              Сохраняются {target === "remote" ? "в базу Supabase" : "в этом браузере"} ·
              всего эталонов: {vision.library?.totalSamples ?? "…"}
            </p>
          </div>
          <div className="admin-actions">
            <Button
              variant="secondary"
              icon={<Download size={17} />}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  download("samples.json", await gestureRepository.exportBundle(tolerance));
                  return "Файл samples.json скачан. Положите его в public/data/ и закоммитьте.";
                })
              }
            >
              Экспорт JSON
            </Button>
            <label className="button button--secondary admin-import">
              <Upload size={17} />
              Импорт JSON
              <input type="file" accept="application/json,.json" onChange={importFile} hidden />
            </label>
          </div>
        </header>

        <div className="admin-grid">
          <aside className="admin-list card">
            <div className="admin-tabs" role="tablist">
              {(["letter", "word"] as const).map((item) => (
                <button
                  key={item}
                  role="tab"
                  aria-selected={category === item}
                  className={category === item ? "active" : ""}
                  onClick={() => {
                    setCategory(item);
                    const first = allGestures.find((gestureItem) => gestureItem.category === item);
                    if (first) setSelectedId(first.id);
                  }}
                >
                  {item === "letter" ? "Буквы" : "Слова"}
                </button>
              ))}
            </div>
            <ul>
              {list.map((item) => {
                const count = counts[item.id] ?? 0;
                return (
                  <li key={item.id}>
                    <button
                      className={`admin-item ${item.id === gesture.id ? "active" : ""} ${count ? "" : "empty"}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.kind === "dynamic" ? "движение" : "статичный"}</span>
                      <span className="admin-count">{count}</span>
                      {vision.library?.content[item.id]?.imageUrl && <ImagePlus size={14} aria-label="есть фото" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="admin-main">
            <div className="admin-camera">
              <div className={`camera-frame ${mode === "recording" ? "searching" : ""}`}>
                <video ref={camera.videoRef} autoPlay muted playsInline aria-label="Камера" />
                <canvas ref={canvas} aria-hidden="true" />
                {mode === "countdown" && <span className="admin-countdown">{countdown}</span>}
                {failure && (
                  <div className="camera-center">
                    <h2>{failure.title}</h2>
                    <p>{failure.message}</p>
                  </div>
                )}
                {trackingStatus === "loading" && camera.status === "ready" && (
                  <span className="camera-caption">Загружаем модель…</span>
                )}
                {trackingStatus === "error" && (
                  <span className="camera-caption">Модель не загрузилась — проверьте интернет</span>
                )}
              </div>
              {mode === "recording" && (
                <div className="admin-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
                  <span style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
            </div>

            <div className="admin-panel card">
              <span className="eyebrow">
                {gesture.category === "letter" ? "Буква" : "Слово"} ·{" "}
                {gesture.kind === "dynamic" ? "с движением" : "статичный"}
              </span>
              <h2>{gesture.title}</h2>
              <p>
                Эталонов: <strong>{counts[gesture.id] ?? 0}</strong>
                {pending.length > 0 && <> · новых к сохранению: <strong>{pending.length}</strong></>}
              </p>
              <p className="admin-tip">
                {gesture.kind === "static"
                  ? `Нажмите «Записать», после отсчёта держите жест неподвижно ~3 с — сохранится ${STATIC_SAMPLES} примеров и фото.`
                  : "Нажмите «Записать», после отсчёта покажите жест целиком и опустите руку. Запишите 5 повторов."}
              </p>
              <div className="action-row">
                <Button
                  icon={gesture.kind === "dynamic" ? <Video size={17} /> : <Camera size={17} />}
                  disabled={trackingStatus !== "ready" || mode === "countdown" || mode === "recording" || busy}
                  onClick={startRecording}
                >
                  {pending.length ? "Записать ещё" : "Записать"}
                </Button>
                <Button
                  variant="secondary"
                  icon={<ImagePlus size={17} />}
                  disabled={trackingStatus !== "ready" || busy}
                  onClick={() => {
                    clearCountdown();
                    setPhoto(null);
                    const state = recording.current;
                    state.photoTaken = false;
                    let value = 3;
                    setCountdown(value);
                    setMode("countdown");
                    countdownTimer.current = window.setInterval(() => {
                      value -= 1;
                      setCountdown(value);
                      if (value <= 0) {
                        clearCountdown();
                        state.wantPhoto = true;
                        setMode(pending.length ? "review" : "idle");
                      }
                    }, 800);
                  }}
                >
                  Переснять фото
                </Button>
                <Button
                  variant={mode === "test" ? "primary" : "ghost"}
                  icon={<ScanLine size={17} />}
                  disabled={trackingStatus !== "ready"}
                  onClick={() => {
                    clearCountdown();
                    recording.current.segmenter.reset();
                    setReadout(null);
                    setMode(mode === "test" ? "idle" : "test");
                  }}
                >
                  {mode === "test" ? "Закончить проверку" : "Проверить распознавание"}
                </Button>
              </div>

              {(pending.length > 0 || photo) && mode !== "recording" && (
                <div className="admin-review">
                  {imageSrc && <img src={imageSrc} alt={`Фото жеста ${gesture.label}`} />}
                  <div className="action-row">
                    <Button icon={<Save size={17} />} loading={busy} onClick={() => void save()}>
                      Сохранить
                    </Button>
                    <Button variant="ghost" onClick={reset}>
                      Отменить
                    </Button>
                  </div>
                </div>
              )}

              {mode === "test" && (
                <div className="admin-readout" aria-live="polite">
                  {readout?.note && <p>{readout.note}</p>}
                  {readout?.distance !== undefined && (
                    <p>
                      Расстояние до «{gesture.label}»: <strong>{readout.distance.toFixed(3)}</strong> · порог{" "}
                      <strong>{readout.accept?.toFixed(3)}</strong> · сходство{" "}
                      <strong>{Math.round((readout.similarity ?? 0) * 100)}%</strong>
                    </p>
                  )}
                  {readout?.hint && <p className="admin-hint">{readout.hint}</p>}
                  {readout && readout.ranking.length > 0 && (
                    <ol>
                      {readout.ranking.map((item) => (
                        <li key={item.label}>
                          {item.label} — {item.distance.toFixed(3)}
                        </li>
                      ))}
                    </ol>
                  )}
                  <label className="admin-tolerance">
                    Строгость: {tolerance.toFixed(2)} (больше — мягче)
                    <input
                      type="range"
                      min="0.6"
                      max="2"
                      step="0.05"
                      value={tolerance}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setTolerance(value);
                        settingsService.setToleranceOverride(value);
                      }}
                    />
                  </label>
                  <small>
                    Значение сохраняется на этом устройстве и попадает в экспорт JSON. Для
                    всех пользователей задайте VITE_RECOGNITION_TOLERANCE в Vercel.
                  </small>
                </div>
              )}

              <label className="admin-description">
                Описание жеста (видят ученики в теории)
                <textarea
                  value={description}
                  rows={4}
                  maxLength={600}
                  placeholder="Например: пальцы сжаты в кулак, большой палец прижат сбоку к указательному, ладонь к собеседнику."
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <div className="action-row">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await gestureRepository.saveContent(target, {
                        id: gesture.id,
                        description,
                        imageUrl: content?.imageUrl,
                      });
                      return "Описание сохранено.";
                    })
                  }
                >
                  Сохранить описание
                </Button>
                <Button
                  variant="ghost"
                  icon={<Trash2 size={17} />}
                  disabled={busy || !(counts[gesture.id] ?? 0)}
                  onClick={() => setConfirmDelete(true)}
                >
                  Удалить эталоны
                </Button>
              </div>
              {message && <p className="notice" role="status">{message}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          </div>
        </div>
      </section>
      {confirmDelete && (
        <Modal title={`Удалить все эталоны «${gesture.label}»?`} onClose={() => setConfirmDelete(false)}>
          <p>Распознавание этого жеста перестанет работать, пока вы не запишете новые.</p>
          <div className="action-row">
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(false);
                void run(async () => {
                  await gestureRepository.deleteSamples(target, gesture.id);
                  return "Эталоны удалены.";
                });
              }}
            >
              Удалить
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Отмена
            </Button>
          </div>
        </Modal>
      )}
    </Page>
  );
}
