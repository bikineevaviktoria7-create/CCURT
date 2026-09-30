# План перехода на ООП (SignStep)

Правила — `dop/OOP_RULES.md` + `dop/REFACTOR_RULES.md`. Поведение, числа, тексты, ключи хранилища, запросы к Supabase не меняются.

## Главный приём: фабрика остаётся, внутри — класс
`createX(...)` сохраняет имя и сигнатуру и становится тонкой обёрткой `return new X(...)`. Экспорты-экземпляры сохраняют имена: `export const xService = new XService(...)`.
Поэтому хуки, страницы и тесты не меняются, а подмены модулей в `adapterLifecycle.test.ts` (по именам `createGestureRecognizer`, `createDemoVisionAdapter`) продолжают работать.
**Важно:** внутри классов зависимости создавать через фабрики (`createGestureRecognizer`, `createDemoVisionAdapter`), а не через `new` — иначе тестовые двойники не подставятся.

## Классы и интерфейсы
| Шаг | Было | Станет | Интерфейс (где) | Зависимости / заметки | Риск |
| --- | --- | --- | --- | --- | --- |
| O1 | `createGestureRecognizer` (recognizer.ts) | `class GestureRecognizer` | `GestureRecognizerApi { recognizeFrame(frame): RecognitionResult; reset(): void; readonly available: boolean }` — в recognizer.ts рядом с `VisionFrame` | `RecognizerOptions` через конструктор; поля stabilizer/hintSelector/segmenter/succeeded/verdict/noHandSince; `available` — геттер; внутренние функции → `private` методы | С |
| O1 | `HoldStabilizer`, `HintSelector`, `MotionSegmenter` | без изменений | не добавляем (у каждого один потребитель — распознаватель) | уже классы | Н |
| O2 | `createDemoVisionAdapter` | `class DemoVisionAdapter implements VisionAdapter` | `VisionAdapter` — уже в `src/types/vision.ts` | `targetLabel`, `callbacks` через конструктор; `readonly mode = "demo"`; `tick` — стрелочное поле (уходит в `setInterval`) | С |
| O2 | `createMediaPipeVisionAdapter` | `class MediaPipeVisionAdapter implements VisionAdapter` | `VisionAdapter` | `options`, `callbacks`; распознаватель через `createGestureRecognizer`; `recognizeVideoFrame` и всё, что уходит в цикл кадров/обработчики, — стрелочные поля; `generation`/`finished` логика без изменений | В |
| O2 | `createVisionAdapter` | остаётся функцией-фабрикой | — | выбирает класс («Стратегия» + «Фабрика»); вызывает `createDemoVisionAdapter`/`createMediaPipeVisionAdapter` | Н |
| O4 | `settingsService` | `class SettingsService` | `SettingsStore { get; update; subscribe; learnerName }` в settingsService.ts | `storage`; **`get` и `subscribe` — стрелочные поля** (передаются в `useSyncExternalStore`) | С |
| O4 | `previewService` | `class PreviewService` | в previewService.ts | `storage`, `getCurrentUser`; `previewGesture` остаётся константой | Н |
| O4 | `authService` | `class MockAuthService` | `AuthService` в `src/types/auth.ts` | `storage`; **`getCurrentUser` — стрелочное поле** (`useState(authService.getCurrentUser)`); `isRemote` — поле | С |
| O4 | `gestureRepository` | `class GestureRepository` | в gestureRepository.ts | `supabase`, `localDb`; методы-слушатели — стрелочные поля | С |
| O4 | `progressService` | `class ProgressService` | в progressService.ts | `storage`; `this.getProgress` сохраняется; все экспортируемые функции (`calculateLessonResult`, `isPassedResult`, `streakDays`, `emptyProgress`, `lessonStatus`, `frequentErrors`, `isLessonResult`…) остаются функциями | С |
| O4 | `syncService` | `class SyncService` | в syncService.ts | `supabase`, `storage`, `progressService`; `enabled` — поле, вычисляется так же; `flushing` → поле; порядок `push → flush` и `pull` без изменений | В |
| O5 | `createSkeletonOverlay` | `class SkeletonOverlay` | `SkeletonOverlayApi { draw; dispose }` в drawHandSkeleton.ts | `video`, `canvas`, `ctx`, `colors`; **фабрика по-прежнему возвращает `undefined`**, если нет video/canvas/ctx (проверка до `new`); `redraw` — стрелочное поле (уходит в `ResizeObserver`) | С |
| O5 | `soundFeedback` | `class SoundFeedback` | в soundFeedback.ts | `settingsService` через конструктор; поля audio/lastHintAt/russianVoice | С |
| O5 | `storage` | `class BrowserStorage` | `KeyValueStorage` в storage.ts | префикс и `memory` как поля; `isPersistent` — стрелочное поле | С |

## Остаются функциями (и почему)
Чистые вычисления без состояния проще тестировать: `normalize`, `features`, `staticMatcher`, `dynamicMatcher` (DTW, `resample`, `analyzeDynamic`), `errorAnalyzer`, `hints`, `landmarkers`, `hasModel`, `pickHand`, `initialRecognition`, `drawHandSkeleton`, `accessService`, `gestureLibrary`, `isRecord`, чистые функции `progressService`.
`localDb` — не трогаем: `set` вызывается только в тестах, выгоды для архитектуры нет («класс ради класса»).
React-компоненты, хуки и `ErrorBoundary` — без изменений.

## Тесты
При соблюдении «главного приёма» тесты **не меняются**. Если без правки никак — только создание объектов и ключи подмены (п. 1 `OOP_RULES.md`), с объяснением в отчёте.

## Проверка каждого шага
Раздел 4 `REFACTOR_RULES.md` + grep запрещённого синтаксиса:
`grep -rnE "constructor\([^)]*\b(private|public|protected|readonly) |\benum |\bnamespace |^\s*@[a-zA-Z]" src` — пусто.
O1–O2: cv-engineer, 0 расхождений с HEAD (`git archive HEAD | tar -x -C /tmp/signstep-head`). O4: backend-engineer по diff.

## Шаги и порядок
O1 распознаватель (С) → O2 адаптеры (В) → O3 документация, метка `oop-core` → O4 сервисы по одному: settings → preview → auth → gestureRepository → progress → sync (В) → O5 SkeletonOverlay → soundFeedback → storage.
