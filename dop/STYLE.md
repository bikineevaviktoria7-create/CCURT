# SignStep: единый стиль кода

Правила описывают то, как уже написано большинство кода, чтобы при унификации переименовывать как можно меньше. У каждого правила указано, на что оно опирается: подсчёт по `src/` и `dop/tests/` на коммите `d6a5614` через grep и разбор импортов. Отдельно перечислены исключения. Это кандидаты на переименование, а не ошибки, которые обязательно исправлять.

Как читать пометки у кандидатов:
- **Н**: низкий риск. Локальное имя в одном файле или порядок импортов.
- **С**: средний риск. Экспортируемое имя, несколько файлов, тесты или документация.
- **не менять**: имя внешнее или закреплено тестом, см. раздел 7.

Переименование делается по `dop/REFACTOR_RULES.md`: все места использования меняются в том же шаге. Если имя упоминается в `README.md` или `dop/CODE_DEFENSE.md`, документ обновляется вместе с кодом.

Объём кода: 66 файлов в `src/` (40 `.ts`, 26 `.tsx`) и 14 файлов в `dop/tests/` (11 тестов, 3 хелпера).

---

## 0. Базовое форматирование

| Правило | Опора | Исключения |
| --- | --- | --- |
| Строки в двойных кавычках `"…"` | 67 из 72 файлов с импортами пишут импорты только в двойных кавычках; во всех тестах двойные кавычки | Одинарные кавычки: `components/common/Button.tsx`, `components/common/ErrorBoundary.tsx`, `pages/NotFoundPage.tsx`, `main.tsx`. Смешанный стиль: `components/lessons/GestureReference.tsx`. Одинарные кавычки в строковых union-типах: `types/auth.ts`, `types/lesson.ts`, `types/vision.ts` (при этом `vision/types.ts` и `types/progress.ts` используют двойные). **Н** |
| Отступ 2 пробела, без табов; `;` в конце инструкций | Табов 0 файлов | Нет |
| Конфиги вне `src` (`eslint.config.js`, `vite.config.ts`) не трогаем | Они не входят в унификацию `src/` | Там одинарные кавычки, это допустимо |

---

## 1. Именование файлов

Общее правило: **файл называется по главному экспорту**. Если в файле есть JSX, расширение `.tsx` (26 из 26 `.tsx` содержат JSX, в `.ts` JSX нет). Файлы `.tsx` с React-компонентом называются в PascalCase, все остальные в camelCase. Для модулей из нескольких функций одной темы допускается имя-роль: `staticMatcher`, `errorAnalyzer`, `landmarkers`.

| Папка | Правило | Опора | Исключения (кандидаты) |
| --- | --- | --- | --- |
| `components/<область>/` | `PascalCase.tsx`, имя = главный компонент. Подпапки по области: `camera`, `common`, `feedback`, `layout`, `lessons`, `progress` | 14 из 14 | Нет. В `GestureFeedback.tsx` есть ещё `GestureCountdown`, в `ErrorBoundary.tsx` есть `ErrorFallback`, в `ProtectedRoutes.tsx` есть `PreviewRoutes`: второстепенные компоненты рядом с главным допустимы |
| `pages/` | `<Имя>Page.tsx`, экспорт `<Имя>Page` | 8 из 8 | Нет. `PreviewPage.tsx` экспортирует и `PreviewResultPage`: так задумано, маршрут лениво грузит оба из одного файла |
| `hooks/` | `use<Имя>.ts`, экспорт `use<Имя>` | 5 из 5 (с шага 5 добавлен общий хелпер `useLatestRef`) | Хуки вне `hooks/`: `useApp` (`context/appState.ts`), `useSettings` (`services/settingsService.ts`), `useGestureLibrary` (`services/gestureLibrary.ts`). Правило: хук-обёртка над контекстом или стором лежит рядом с ним. Сейчас так сделано во всех 3 случаях, переносить не нужно |
| `services/` | `<домен>Service.ts`, если файл экспортирует объект-сервис `<домен>Service` или функции домена. `<домен>Repository.ts`, если модуль только загружает и кеширует данные из источников | 6 из 8 `*Service.ts` плюс 1 `*Repository.ts` | `gestureLibrary.ts`: построение моделей и хук, объединены намеренно (см. `CODE_DEFENSE.md`, «Что упростилось»). **не менять** без решения тимлида |
| `lib/` | `camelCase.ts`, модули без React | 7 из 7 | Нет |
| `vision/` | `camelCase.ts`, чистые модули. Браузерный код только в `landmarkers.ts` | 10 из 10 | Нет |
| `integrations/` | `<источник>VisionAdapter.ts`, по одной реализации `VisionAdapter` на файл | 1 из 2 | `visionAdapter.ts` содержит демо-адаптер (`createMockVision`), а сам интерфейс `VisionAdapter` лежит в `types/vision.ts`. Кандидат: `demoVisionAdapter.ts`, см. таблицу понятий, строки 9 и 16. **С**: тест `adapterLifecycle` подменяет модуль по ключу `"./visionAdapter"` |
| `types/` | Одно слово в нижнем регистре, домен: `auth`, `lesson`, `loading`, `progress`, `vision`. Типы только для CV-конвейера лежат в `vision/types.ts` | 5 из 5 | Нет |
| `context/` | Провайдер `AppProvider.tsx`, контекст и хук `appState.ts` (по интерфейсу `AppState`) | 2 из 2 | Нет |
| `app/`, `data/` | `App.tsx`, `router.tsx` (экспорт `router`), `constants.ts`, `alphabet.ts`, `lessons.ts` | Соответствуют общему правилу | Нет |
| `dop/tests/` | `<тема>.test.ts` в camelCase. Тема означает сценарий и не обязана совпадать с именем модуля. Хелперы лежат в `dop/tests/helpers/<имя>.ts` | 11 из 11, хелперы 3 из 3 | `demoAuth.test.ts` проверяет mock-аккаунты, кандидат `mockAuth.test.ts` (строка 10 таблицы понятий). **С**: имя файла есть в `.qa/baseline.md`, число тестов не меняется |

---

## 2. Именование сущностей

### 2.1 Компоненты
- PascalCase, существительное: `LearningPath`, `GestureFeedback`. Страницы называются `*Page`, обёртки маршрутов `*Routes`, состояние загрузки или ошибки `ContentState`. Опора: 28 из 28 экспортируемых компонентов.
- Объявляются через `export function Имя(...)`: 26 из 28. Исключения по необходимости: `Button` через `forwardRef`, `ErrorBoundary` классом (error boundary в React бывает только классом). **не менять**.
- Props описываются инлайн-типом в параметре: `({ gesture }: { gesture: Gesture })`. Так в 17 из 18 компонентов с props. Исключение: `ButtonProps` в `Button.tsx`, где нужен `extends ButtonHTMLAttributes`. **не менять**.
- Внутренние компоненты страницы не экспортируются и объявляются тем же способом: `LessonPlayer`, `CompletedLesson`, `NameStep`, `ScoreReveal`, `AccuracyTrend`.

### 2.2 Хуки
- `use<Имя>`, возвращают объект `{ … }`: 5 из 5 хуков с несколькими значениями. `useSettings` и `useApp` возвращают одно значение.
- Переменная с результатом хука называется как хук без `use`: `const camera = useCamera()`, `const recognition = useRecognition(…)`, `const settings = useSettings()`, `const session = useLessonSession(…)`. Опора: 4 из 5.
  - Исключение: `components/camera/PracticeGesture.tsx:43` `const vision = useGestureLibrary(…)`. Кандидат `gestureLibrary` (строка 17 таблицы понятий). **Н**
- Refs называются без суффикса `Ref`: 18 из 22 (`canvas`, `generation`, `current`). Суффикс нужен, только если рядом есть одноимённое значение или ref отдаётся наружу: `pausedRef` (есть prop `paused`), `streamRef` (есть локальная `stream`), `videoRef` (возвращается из `useCamera` и передаётся в `ref=`), `adapterRef` (в эффекте `useRecognition` есть локальная `adapter`). Эти 4 случая соответствуют правилу.
- Ref, который при каждом рендере хранит последнее значение (`ref.current = value`), создаётся через `useLatestRef(value)` (`hooks/useLatestRef.ts`), а не вручную: `current` в `AppProvider`, `callback` и `pausedRef` в `useRecognition`.
- `useState`: `[x, setX]` в 25 из 27 пар. Исключения: `[user, updateUser]` и `[progress, updateProgress]` в `context/AppProvider.tsx`, потому что имя `setUser` занято методом контекста. **не менять**.

### 2.3 Сервисы и объекты-синглтоны
- Объект со стейтом или доступом к хранилищу экспортируется как `export const <домен>Service = { … }`: `authService`, `previewService`, `progressService`, `settingsService`, `syncService`. Так в 5 из 6 файлов `*Service.ts`. Репозиторий называется `gestureRepository`. Утилиты хранения и вывода называются по сути: `storage`, `localDb`, `feedback`, `hints`.
  - Исключение: `accessService.ts` экспортирует отдельные функции (`currentUser`, `canUsePlatform`, `canReadProgress`, `requirePlatform`), а не объект. **не менять** на этапе унификации: оборачивание в объект меняет API в 5 файлах и относится к этапу ООП.
- Чистые функции домена экспортируются рядом с объектом отдельными named-экспортами: `calculateLessonResult`, `lessonStatus`, `streakDays` в `progressService.ts`.
- Методы называются глаголами: `completeLesson`, `mergeResults`, `push`, `flush`, `pull`, `load`, `invalidate`, `update`, `login`, `logout`. Подписка на событие называется `on<Событие>(listener)` и возвращает функцию отписки: `gestureRepository.onChange`, `authService.onSignedOut`, `onVideoFrames` (3 из 4). Исключение: `settingsService.subscribe`, имя повторяет сигнатуру `useSyncExternalStore`. **не менять**.

### 2.4 Типы и интерфейсы
- PascalCase, без префикса `I` (0 случаев), без `enum` и `namespace` (0 случаев; их не поддерживает `--experimental-strip-types`).
- Форму объекта описывает `interface`: 46 из 46 объектных типов. `RecognitionConfig` (`hooks/useRecognition.ts`) переведён на `interface` на шаге 5; файл остаётся прежним.
- Union и алиасы описывает `type`: 12 из 12 (`RecognitionStatus`, `LessonPhase`, `Hand`, `FingerName`).
- Имя собирается из домена и роли: `LessonResult`, `GestureAttempt`, `StaticGestureModel`. Для пар «статика и динамика» оба имени получают префикс: `StaticGestureModel`/`DynamicGestureModel`, `StaticDecision`, `DynamicAnalysis`.
  - Исключения: `Analysis` (`vision/errorAnalyzer.ts:28`, только статика) → `StaticAnalysis`; `distanceToModel` (`vision/staticMatcher.ts`, 5 вхождений, в том числе в `vision.test.ts`) → `distanceToStaticModel`, в пару к `distanceToDynamicModel`. **Н** и **С**.
- Строка из Supabase описывается типом `<Сущность>Row` с полями в snake_case, как в БД: `SampleRow`, `GestureRow` (2 из 3). Исключение: `Row` (`components/progress/Leaderboard.tsx:5`) → `LeaderboardRow`. **Н**. Snake_case допустим только в этих Row-типах и в объектах, которые отправляются в Supabase.
- Действия редьюсера: `LessonSessionState` и `lessonSessionReducer` принимают `LessonSessionAction` (переименован из `SessionAction` на шаге 5).

### 2.5 Функции
- Экспортируемые функции объявляются через `export function`: 95 из 104. Исключения, стрелки в `export const`: `sub`, `dot`, `cross`, `length`, `distance` (`vision/normalize.ts`), `initialRecognition` (`integrations/visionAdapter.ts`, отложено до этапа ООП), `canUsePlatform`, `canReadProgress` (`services/accessService.ts`), `emptyProgress` (`services/progressService.ts`). **Н**: меняется только форма объявления, имена и поведение остаются.
- Неэкспортируемые хелперы пишутся через `function` (39) или стрелкой в `const` (17). Оба варианта допустимы; стрелка уместна для однострочных выражений.
- Глаголы по назначению (подсчёт по экспортам):

| Префикс | Когда | Примеры |
| --- | --- | --- |
| `create*` | Объект с состоянием или жизненным циклом (фабрика) | `createGestureRecognizer`, `createVisionAdapter`, `createSkeletonOverlay` (3 из 5 с именем «create + тип результата», исключения в таблице понятий, строка 16) |
| `build*` | Производная структура данных из входных данных | `buildStaticModel(s)`, `buildDynamicModels`, `buildNameGestures` |
| `make*` | Локальный конструктор простого объекта | `makeResult` (2 модуля), `makeHand` (тест) |
| `initial*` / `empty*` | Начальное значение | `initialSession`, `initialRecognition`, `emptyProgress` |
| `load*` | Асинхронная загрузка из источника | `loadGestureLibrary`, `loadBundle`, `loadRemoteSamples`, `gestureRepository.load` (8 из 9; `fetchModel` означает именно сетевой `fetch`, допустимо) |
| `get*` | Чтение сохранённого или кешированного состояния | `getProgress`, `getResult`, `getHandLandmarker`, `settingsService.get` (8 из 11) |
| `is*` / `has*` / `can*` | Предикат или type guard, возвращает `boolean` | `isLessonResult`, `isDemoResult`, `hasModel`, `canReadProgress` (13 из 17) |
| существительное результата | Чистое вычисление без побочных эффектов | `similarity`, `lessonStatus`, `streakDays`, `dtwDistance`, `handLocation` |
| прочие глаголы | Действие | `calculateLessonResult`, `analyzeGestureErrors`, `extractHandFeatures`, `normalizeHand`, `recognizeFrame`, `pickHand` |

  - Исключения для `get*`: `currentUser` (`accessService.ts`, 17 вхождений в 6 файлах, есть в тестах) и его алиас `authService.getUser`; `settingsService.learnerName` (в паре с `setLearnerName`); `settingsService.toleranceOverride`. См. таблицу понятий, строки 13 и 14. **С**
  - Исключения для предикатов: `validId`, `validDate`, `validMode`, `numberIn` (`services/progressService.ts`, локальные) → `isValidId`, `isValidDate`, `isValidMode`, `isNumberIn`. **Н**

### 2.6 Переменные
- camelCase. Идентификаторы `id` называются `<сущность>Id`: `lessonId`, `gestureId`, `sessionId`, `userId`.
- Метка времени заканчивается на `*At` (`startedAt`, `changedAt`, `pausedAt`, `lastHintAt`, `completedAt`), момент начала состояния на `*Since` (`noHandSince`, `stillSince`, `lostSince`), длительность на `*Ms` (`durationMs`, `holdMs`, `minMs`, `CONTENT_TIMEOUT_MS`, `MAX_MS`).
  - Исключения: `lastEmit` (`integrations/mediaPipeVisionAdapter.ts`) → `lastEmitAt`; `lastTime` (`vision/stabilizer.ts`) → `lastFrameAt`. **Н**. `lastTime` в `onVideoFrames` хранит `video.currentTime`, а не метку времени, его не трогаем.

### 2.7 Константы
- `UPPER_SNAKE_CASE` для неизменяемых настроек и справочников: числа и пороги, версии, ключи хранилищ, пути, таблицы соответствий в алгоритмах и UI. Опора: 43 модульные константы (`FEATURE_VERSION`, `MIN_ACCEPT_DISTANCE`, `LOCAL_SAMPLES`, `QUEUE`, `DB_NAME`, `FINGER_TITLES`, `DESCRIPTIONS`, `ROUTES`).
- camelCase для учебных данных (`lessons`, `alphabet`, `words`, `lessonSections`, `allGestures`, `previewExercise`), объектов-синглтонов (`storage`, `hints`, `authService`) и изменяемых коллекций модуля (`memory`, `listeners`, `specs`).
- Исключения, где константа-настройка записана в camelCase (**Н**, значения не меняются):

| Сейчас | Файл | Кандидат |
| --- | --- | --- |
| `prefix` | `lib/storage.ts:1` | `STORAGE_PREFIX` |
| `legacyKey` | `services/previewService.ts:15` | `LEGACY_PREVIEW_KEY` |
| `connections` | `lib/drawHandSkeleton.ts:3` | `HAND_CONNECTIONS` |
| `bases` | `vision/features.ts:52` | `FINGER_BASES` |
| `defaults` | `services/settingsService.ts:5` | `DEFAULT_SETTINGS` |
| `offsets` | `components/lessons/LearningPath.tsx:10` | `NODE_OFFSETS` |
| `errorLabels` (экспорт, 2 файла) | `services/progressService.ts:12` | `ERROR_LABELS` (**С**) |
| `cameraMessages` (экспорт, 2 файла) | `hooks/useCamera.ts:5` | `CAMERA_MESSAGES` (**С**) |

- Константы одной темы получают одинаковое окончание: `MIN_ACCEPT_DISTANCE`/`MAX_ACCEPT_DISTANCE`/`DEFAULT_ACCEPT_DISTANCE`. Исключения: `MIN_DYNAMIC_ACCEPT`, `MAX_DYNAMIC_ACCEPT`, `DEFAULT_DYNAMIC_ACCEPT` (`vision/dynamicMatcher.ts`) → `*_DYNAMIC_ACCEPT_DISTANCE`. **Н**, числа не меняются.

### 2.8 Булевы значения
- Предикаты (функции) начинаются с `is`/`has`/`can`, см. 2.5.
- Поля и состояния называются прилагательным или причастием (`paused`, `running`, `enabled`, `loading`, `ready`, `mirrored`, `compact`, `transitioning`, `success`, `skipped`) или по шаблону `<что>Enabled`/`<что>Ready`/`<что>Visible`/`<что>Completed` (`soundEnabled`, `authReady`, `passwordVisible`, `calibrationCompleted`). Префикс `is`/`can` используется там, где это признак сущности: `isGuest`, `isRemote`, `canSimulate`. Так записано большинство из ~30 булевых полей.
- Исключения, булево значение под именем существительного или глагола (**Н**):

| Сейчас | Где | Кандидат |
| --- | --- | --- |
| `exit` / `setExit` | `pages/LessonPage.tsx` (`LessonPlayer`) | `exitRequested` / `setExitRequested` |
| `modelError` | `hooks/useRecognition.ts`, `PracticeGesture.tsx` | `modelFailed` |
| `handVisibility` (prop) | `components/feedback/GestureFeedback.tsx` | `handVisibilityCheck` |
| `demo` | `pages/ResultsPage.tsx:73` | `isDemo` |

### 2.9 Обработчики и колбэки
- Колбэк в props или параметрах называется `on<Событие>`: `onAccept`, `onClose`, `onResult`, `onFrame`, `onError`, `onSuccess`. Имён `handle*` в коде 0.
- Обработчик внутри компонента называется глаголом действия без `handle`: `submit` (2 файла), `start`, `toggle`, `unlock`. Короткие обработчики пишутся инлайн-стрелкой в JSX.

---

## 3. Порядок импортов

Порядок групп (пустые строки между группами не ставятся: так в 72 из 72 файлов):

1. `node:*`, только в тестах: `node:assert/strict`, затем `node:test`.
2. Внешние пакеты. Первым идёт `react` (14 из 14 файлов, где есть `react` и другие пакеты), затем остальные в любом порядке. Тип из того же пакета импортируется отдельной строкой `import type { … }` сразу после value-импорта этого пакета: `import { useEffect } from "react"; import type { ReactNode } from "react";` (8 из 11 файлов). Побочные импорты (`@fontsource…`, `./styles.css`) остаются в конце группы, как в `main.tsx`.
3. Внутренние модули (относительные пути), value-импорты. Порядок внутри группы не регламентируется.
4. `import type` из внутренних модулей, последними (23 из 35 файлов, где есть и value-, и type-импорты из своих модулей).

Дополнительные правила:
- **Только относительные пути.** Алиасов нет ни в `tsconfig`, ни в `vite.config.ts`, 100% импортов относительные.
- Если из внутреннего модуля берутся и значения, и типы, типы пишутся в том же импорте через `type`: `import { buildDynamicModels, type DynamicGestureModel } from …`. Так в 11 из 12 случаев. Исключение: `hooks/useLessons.ts` импортирует `gestureRepository` и `import type { GestureContent }` из одного модуля двумя строками. **Н**
- Модуль импортируется один раз. Исключение: `components/camera/PracticeGesture.tsx` импортирует `../../services/gestureLibrary` двумя строками. **Н**
- Импорты стоят в начале файла. Исключения: `dop/tests/lessonFlow.test.ts` (импорты посреди файла, `beforeEach` между импортами), `dop/tests/previewRecognition.test.ts` (импорты посреди файла), `dop/tests/progressValidation.test.ts` (`beforeEach` между импортами). **Н**, переносятся только импорты, вызов `beforeEach` остаётся на месте.
- **Расширение `.ts` в пути** (жёсткое правило, иначе ломаются тесты):
  - Модули, которые тесты импортируют напрямую (`vision/*` кроме `landmarkers.ts`, `lib/storage.ts`, `lib/localDb.ts`, `lib/nameLesson.ts`, `lib/drawHandSkeleton.ts`, `data/*`, `app/constants.ts`, `hooks/useLessonSession.ts`, `services/accessService.ts`, `services/previewService.ts`, `services/progressService.ts`): **runtime-импорты своих модулей пишутся с `.ts`**. Сейчас так все такие импорты, иначе `node --experimental-strip-types` не найдёт модуль. Всего в `src/` 36 строк импорта с `.ts`, все в этих 14 файлах.
  - Модули, которые тесты грузят через `loadBrowserModule` (`integrations/mediaPipeVisionAdapter.ts`, `vision/landmarkers.ts`, `lib/feedback.ts`, `services/authService.ts`, `services/syncService.ts`): **импорты пишутся без расширения**. Тесты подменяют зависимости по точной строке импорта (`"./visionAdapter"`, `"../lib/storage"`). Если строку меняют, в том же шаге меняют и ключ в тесте.
  - Остальные файлы `src/` пишут импорты без расширения (всего в `src/` 184 строки относительных импортов без `.ts`).
  - Type-импорты стираются при запуске, расширение для них не обязательно. Как сейчас: в `vision/` с `.ts`, в остальных папках без него. Исключение: `lib/nameLesson.ts` (type-импорт с `.ts`, безвредно). **не менять**.
  - В тестах все относительные импорты с `.ts`: 50 из 52. Исключения, type-импорты без расширения: `feedback.test.ts`, `demoAuth.test.ts`. **Н**

Файлы, где порядок групп нарушен (кандидаты **Н**, только перестановка строк):
- Внутренний импорт стоит выше внешних (обычно `uiText`, `feedback` или `hints` добавлены первой строкой): `app/App.tsx`, `components/camera/PracticeGesture.tsx`, `components/common/SettingsPanel.tsx`, `components/feedback/GestureFeedback.tsx`, `components/lessons/GestureReference.tsx`, `components/lessons/LearningPath.tsx`, `pages/AuthPage.tsx`, `pages/LessonOverviewPage.tsx`, `pages/LessonPage.tsx`, `pages/PreviewPage.tsx` (10 из 29 файлов с обеими группами).
- Внутренний `import type` стоит выше value-импортов: `context/AppProvider.tsx`, `data/lessons.ts`, `hooks/useRecognition.ts`, `integrations/mediaPipeVisionAdapter.ts` (там же тип `@mediapipe/tasks-vision` стоит после внутренних), `pages/LessonOverviewPage.tsx`, `services/syncService.ts`, `vision/dynamicMatcher.ts`, `vision/errorAnalyzer.ts`, `vision/recognizer.ts` (в трёх последних первой строкой идёт `import type … from "../types/vision.ts"`).
- Инлайн-`type` из внешнего пакета вместо отдельной строки: `pages/ResultsPage.tsx` (`type CSSProperties`), `lib/supabase.ts`, `vision/landmarkers.ts`.

---

## 4. Экспорт

| Правило | Опора |
| --- | --- |
| Только named-экспорты, `export default` не используется | 0 в `src/` и `dop/tests/` (default есть только в конфигах `eslint.config.js` и `vite.config.ts`, этого требуют инструменты) |
| Экспорт пишется у объявления (`export function`, `export const`, `export interface`); списков `export { a, b }` нет | 0 списков |
| Реэкспортов и `index.ts` нет, импорт идёт напрямую из файла-источника | 0 `index.*`, 0 `export … from` |
| Из `.tsx` экспортируются только компоненты и константы: так требует правило ESLint `react-refresh/only-export-components` (`allowConstantExport`) | Lint проходит |
| Каждый экспорт используется. Неиспользуемые экспорты удаляются после проверки `grep -rn` | `REFACTOR_RULES.md`, раздел 2 |
| Тип, который нужен и UI, и сервисам, лежит в `src/types/<домен>.ts`. Тип одного модуля лежит в этом модуле (`RecognizerOptions`, `GestureContent`, `GestureLibrary`) | Так сейчас устроены все типы |

---

## 5. Комментарии

- **Язык: английский.** 157 из 168 комментариев на английском. На русском 11 комментариев в 6 файлах маршрута для жюри из `CODE_DEFENSE.md`: `integrations/mediaPipeVisionAdapter.ts` (4, шаги конвейера «1. MediaPipe…», «2. Наш код…», «3. Точки рисуем…»), `vision/features.ts` (3), `vision/errorAnalyzer.ts`, `vision/recognizer.ts`, `lib/drawHandSkeleton.ts`, `types/vision.ts` (по 1). Они написаны для защиты проекта. **не менять** без решения тимлида. Новые комментарии пишем на английском.
- **Комментарий к экспорту оформляется как JSDoc** `/** … */`. Там, где комментарий у экспорта есть, это JSDoc в 26 из 32 случаев. Обычно достаточно одной строки: 58 из 68 JSDoc-блоков однострочные. Теги `@param`/`@returns` не используются (1 случай в `lib/nameLesson.ts`); параметр описывается, только если его смысл не виден из имени.
  - Исключения, `//` вместо JSDoc над экспортом:
    - на русском: `createMediaPipeVision`, `createGestureRecognizer`, `extractHandFeatures`, `createSkeletonOverlay`, а также интерфейс `VisionCallbacks`. Это комментарии для жюри, их **не менять**. Если тимлид решит перевести их в JSDoc, текст сохраняется дословно;
    - на английском: `uiText` (`lib/uiText.ts:1`), `authService` (`services/authService.ts:11`). Их можно перевести в `/** … */` без изменения текста. **Н**
- **Целевое правило для публичного API:** у каждой экспортируемой функции и объекта в `vision/`, `lib/`, `services/`, `integrations/`, `hooks/` должна быть однострочная JSDoc. Сейчас она есть у 26 из 85. Меньше всего покрыты `services/` (2 из 22), `hooks/` (0 из 6), `lib/` (2 из 11), `integrations/` (0 из 4); лучше всего `vision/` (19 из 43). Добавление комментариев относится к безопасному режиму. Код и тексты при этом не меняются. Для компонентов и страниц JSDoc не обязателен (2 из 25).
- Однострочный `//` объясняет «почему», а не «что»: `// Commit navigation together with the cleared user, before the route guard redirects.`
- `/* … */` используется только в пустом `catch` или функции-заглушке: `/* Audio is optional. */` (3 случая).
- Сообщения в консоль: префикс `[SignStep]` и текст на русском (8 из 8 вызовов). Это тексты, их не меняем.
- Названия тестов (`test("…")`) на английском, со строчной буквы (53 из 53). Не переименовываем: список тестов зафиксирован в `.qa/baseline.md`.

---

## 6. Таблица понятий

«Вхождения» считаются через `grep -w` по `src/` и `dop/tests/`, включая комментарии. Слово «внешнее» означает, что значение хранится у пользователя, в БД, в URL или в CSS (см. раздел 7). Внутреннее имя подбирается так, чтобы внешние значения не менялись.

| № | Понятие | Текущие варианты (файлы, вхождения) | Выбранное имя | Что переименовать (риск) |
| --- | --- | --- | --- | --- |
| 1 | Эталон: записанный пример жеста для распознавания | `GestureSample`, `sample`, `samples` (~115 вхождений в 15 файлах: `vision/*Matcher.ts`, `services/gestureRepository.ts`, `services/gestureLibrary.ts`); `reference` в том же смысле: `vision/errorAnalyzer.ts` (`reference` 19, `touchReference` 4, `palmReference` 3, `directionReference` 2, `normalReference` 2), `vision/dynamicMatcher.ts` (`reference` 7, ближайший образец); `hasReference` в `vision/recognizer.ts` (4, «есть с чем сравнивать»). Внешнее: поле `samples` в `samples.json`, ключ IndexedDB `admin:samples`, таблица `gesture_samples` | `sample` (в паре «ввод и эталон» пишем `input`/`sample`) | `errorAnalyzer.ts`: `reference` → `sample`, `touchReference` → `touchSample` и т. д. (**Н**, один файл, много мест); `dynamicMatcher.ts`: `reference` → `nearest`, включая поле результата `distanceToDynamicModel`, которое читается только внутри этого файла (**Н**); `recognizer.ts`: `hasReference` → `canEvaluate` (**Н**) |
| 2 | Иллюстрация жеста для пользователя | `GestureReference` (компонент, 14 вхождений в 6 файлах), `ReferenceMedia` (5), `referenceMedia` (6), `gestureReferences` (3); в `hooks/useLessons.ts` есть `drawing` (4) и `media`. Внешнее: колонка `reference_image_url`, в UI «Эталон: …» (текст) | `reference` / `ReferenceMedia` | Не требуется. `drawing` в `useLessons.ts` допустимо как локальное уточнение |
| 3 | Опорные точки тела (нос, плечи) | `BodyReference` (9, 5 файлов) | `BodyReference` | Не требуется. Третье значение слова `reference`; новых значений не вводить |
| 4 | Модель жеста, построенная по эталонам | `StaticGestureModel`, `DynamicGestureModel`, `staticModels`, `dynamicModels`, `model(s)` (~50 в `vision/`, `services/gestureLibrary.ts`). Модели MediaPipe: `HAND_MODELS`, `fetchModel`, `modelLoading`/`modelError` | `model` для модели жеста; объект MediaPipe называется `landmarker` | `integrations/mediaPipeVisionAdapter.ts`: переменные `hand: HandLandmarker` и `pose: PoseLandmarker` → `handLandmarker`/`poseLandmarker`. Сейчас `hand` там конфликтует с `hand` в значении наблюдения руки (**Н**) |
| 5 | Точки руки (массив `Point3[]`) | `landmarks` (`onFrame`, `drawHandSkeleton`, `demoLandmarks`); `points`/`worldPoints` (`vision/normalize.ts`, `vision/features.ts:62`, `createSkeletonOverlay().draw`); `image`/`world` (поля `HandObservation`) | `landmarks`; `image`/`world` там, где важна система координат | `normalizeHand(points)`, `point(points, …)`, `extractHandFeatures(worldPoints)`, `draw(points)` → `landmarks` (**Н**, локальные параметры). Списки номеров точек (`incorrectLandmarks`, `FINGER_LANDMARKS`, `Issue.landmarks`) исторически тоже называются `*Landmarks`; оставить, новых голых `landmarks: number[]` не вводить |
| 6 | Жест / буква / слово | `Gesture`, `gesture` (основное); `letter` = жест категории `letter`; `word` = жест категории `word`; `sign` только в английских комментариях (5). `previewExercise` имеет тип `Gesture` (8 вхождений, 3 файла, есть в `access.test.ts`). Внешнее: значения `category: "letter" \| "word"`, id `letter-N`, `word-<slug>`, `preview-hand` | `gesture`; `letter`/`word` для подтипов | `previewExercise` → `previewGesture` (**С**, затрагивает тест) |
| 7 | Урок и его прохождение | `Lesson`/`lesson` (урок); `session`, `sessionId`, `LessonSessionState`, `useLessonSession` (одно прохождение); `GestureAttempt`/`attempt` (попытка одного жеста); `exercise: "hand-visibility"` (особое упражнение); `NameStep` (блок ввода имени). Внешнее: `sessionId` в результатах, маршрут `/results/:sessionId` | `lesson` / `session` / `attempt` / `exercise` | Сделано на шаге 5: `SessionAction` → `LessonSessionAction` |
| 8 | Результат пройденного урока | `LessonResult`, переменная `result` (основное); при переборе `progress.sessions` в `ProgressChart.tsx`, `streakDays`, `getProgress`, `syncService.pull` используется `session`. Внешнее: поле `sessions` в сохранённом прогрессе | `result`; при переборе массива `sessions` допустимо `session` | Не требуется |
| 9 | Режим распознавания без камеры | `VisionMode = "real" \| "demo"`, `isDemoResult`, `demoLandmarks`, `demoLessons`; но фабрика `createMockVision` (4, 3 файла) и файл `integrations/visionAdapter.ts`. Внешнее: значение `mode: "demo"` в результатах, ключ `demo-result:…` | `demo` | `createMockVision` → `createDemoVisionAdapter`, файл → `integrations/demoVisionAdapter.ts`, ключ подмены в `adapterLifecycle.test.ts` меняется вместе с ним (**С**) |
| 10 | Учебные аккаунты хакатона (вход без сервера) | `authProvider: "mock"`, id `mock-ruslana`, `MOCK_AUTH_ENABLED` (7), `setMockAccount` (8), `helpers/mockAccount.ts`; но `DEMO_USERS` (21, 6 файлов), `DEMO_PASSWORD` (12, 4 файла), `demoAuth.test.ts`. Внешнее: `"mock"`, id `mock-*`, CSS-класс `demo-note`, в текстах README «демо-аккаунты» | `mock` (не `demo`: demo-результаты исключаются из прогресса, а результаты этих аккаунтов настоящие) | `DEMO_USERS` → `MOCK_USERS`, `DEMO_PASSWORD` → `MOCK_PASSWORD`, `demoAuth.test.ts` → `mockAuth.test.ts` (**С**, механическая замена имени в 2 тестах) |
| 11 | Список уроков в тестах | `mockLessons` (15 вхождений в `lessonFlow.test.ts`) — это настоящие `lessons`, импортированные под другим именем | `lessons` | Убрать алиас в импорте `lessonFlow.test.ts` (**Н**) |
| 12 | Гость и предпросмотр | `isGuest`, `authService.guest()`, ключ `guest` (гость = вид пользователя); `preview*`, `PreviewPage`, `previewService` (экран и сценарий для гостя) | `guest` для пользователя, `preview` для сценария | Не требуется |
| 13 | Текущий пользователь | Функция `currentUser()` (17 вхождений в 6 файлах, в том числе тесты `access`, `demoAuth`) и её алиас `authService.getUser` (2). Под тем же именем в `syncService.flush` живёт локальная строка `currentUser` (3), и это id, а не пользователь. Объект `User` называется `user`, запись из списка аккаунтов `account` | `getCurrentUser` (правило `get*` из 2.5) | `currentUser` → `getCurrentUser`, `authService.getUser` → `authService.getCurrentUser` (**С**); локальную строку в `syncService.ts` → `sessionUserId` (**Н**). В `AppProvider.pull(account: User)` параметр назван `account`, чтобы не затенять `user`; оставить |
| 14 | Имя ученика для урока «Своё имя» | `learnerName` / `setLearnerName` (`settingsService`), `toleranceOverride`. Внешнее: ключи `learner-name:<userId>`, `recognition-tolerance` | `getLearnerName` / `setLearnerName`; `getToleranceOverride` | 2 метода, 4 места, тестов нет (**Н**) |
| 15 | Подготовка асинхронного ресурса | `initialize()` (8: `VisionAdapter`, обе реализации, `useRecognition`, тест); `authService.init()` (3, в том числе `demoAuth.test.ts`) | `initialize` | `authService.init` → `authService.initialize` (**С**, затрагивает вызов в тесте) |
| 16 | Адаптер распознавания (`VisionAdapter`) | Переменная `adapter` (`useRecognition` ref, тесты `h.adapter`); `vision` (9 вхождений в эффекте `useRecognition.ts`); фабрики `createVisionAdapter` (выбор), `createMediaPipeVision` (3), `createMockVision` (4) | Переменная `adapter`; фабрики `create<Источник>VisionAdapter` | `useRecognition.ts`: ref `adapter` → `adapterRef` (по правилу 2.2 о совпадении имён), локальную `vision` → `adapter` (**Н**, один файл); `createMediaPipeVision` → `createMediaPipeVisionAdapter` (**С**, есть в `CODE_DEFENSE.md` и `adapterLifecycle.test.ts`); `createMockVision`, см. строку 9 |
| 17 | Библиотека эталонов (`GestureLibrary`) | Тип, поле `library`, `loadGestureLibrary`, `useGestureLibrary`, параметр `library` (5); локальные `context` (7 в `PracticeGesture.tsx`, 3 в `useLessons.ts`) остались от старого названия `GestureContext` (см. `CODE_DEFENSE.md`); `vision` для результата хука (`PracticeGesture.tsx`, 2) | `library`; результат хука называется `gestureLibrary` | `PracticeGesture.tsx`: `context` → `library`, `vision` → `gestureLibrary`; `useLessons.ts`: `context` → `library` (**Н**) |
| 18 | Короткое имя жеста для показа («А») | `label`, `labels`, `targetLabel` (14); но поля `RecognitionResult.targetGesture` (7) и `predictedGesture` (5) тоже хранят метку, а не id | `label` | `targetGesture` → `targetLabel`, `predictedGesture` → `predictedLabel` в `types/vision.ts`, `recognizer.ts`, `visionAdapter.ts`, литерал в `adapterLifecycle.test.ts` (**С**; `RecognitionResult` не сохраняется) |
| 19 | Найденная ошибка исполнения и подсказка к ней | `Issue` (`errorAnalyzer.ts`, 8); инлайн-тип `candidates` (`dynamicMatcher.ts`, 10); `problem`/`environmentProblem` (`recognizer.ts`, 8); выбранная для показа `Hint` (`recognizer.ts`); тексты `hints`; коды `GestureErrorCode`/`errorCodes`. Внешнее: значения кодов и поле `errorCodes` в сохранённых попытках, `hints` в `samples.json` и БД | `Issue` для найденного отклонения, `Hint` для выбранного к показу, `errorCode` для кода | `environmentProblem` → `environmentIssue`, `problem` → `issue` (**Н**). Инлайн-тип в `dynamicMatcher.ts` можно назвать `MotionIssue` (**Н**) |
| 20 | Порог принятия | `acceptDistance` (16, поле модели); локальное и поле `accept` (`StaticDecision.accept`, `recognizer.ts`); `MIN/MAX/DEFAULT_ACCEPT_DISTANCE` и `MIN/MAX/DEFAULT_DYNAMIC_ACCEPT` | `acceptDistance`; константы `*_ACCEPT_DISTANCE` | Константы, см. 2.7 (**Н**). `StaticDecision.accept` оставить: короткое имя внутри решения, читается рядом с `distance` |
| 21 | Строгость распознавания | `tolerance` (24, 8 файлов); `strictness` только в комментариях (3). Внешнее: `tolerance` в `samples.json`, ключ `recognition-tolerance`, `VITE_RECOGNITION_TOLERANCE` | `tolerance` | Не требуется |
| 22 | Теория урока | Идентификаторы: `theoryGestures` (6), `nextTheory`, `NEXT_THEORY`, `theory`, `theoryList`; значение фазы `"learn"` (`LessonPhase`, проверяется в `lessonFlow.test.ts`); CSS `learn-screen`, `learn-card` | `theory` в идентификаторах | Значение `"learn"` **не менять** (тест, CSS) |
| 23 | Имя ученика дактилем | `Lesson.spelledName` (6), переменная `spelled` (23), тип `NameLetters` (3), функция `buildNameGestures` (7, в том числе `lessonFlow.test.ts`) | `spelledName` / тип `SpelledName` | `NameLetters` → `SpelledName` (**Н**); `buildNameGestures` → `buildSpelledName` (**С**, затрагивает тест) |
| 24 | Прогресс обучения и удержание жеста | `LearningProgress`, `LessonProgress`, `progress` (сохранённый прогресс); `holdProgress` (заполнение кольца); `segmenter.progress()`; «статистика» только в UI и CSS (`lesson-statistics`) | `progress` для обучения, `hold*` для удержания | Не требуется |
| 25 | Звук и речь / визуальная обратная связь | `lib/feedback.ts` → `feedback` (звук и речь, 6 файлов и тест); `GestureFeedback` и CSS `feedback-*` (карточка подсказки) | Визуальная: `Feedback`; звук: `soundFeedback` | `feedback` → `soundFeedback`, файл → `lib/soundFeedback.ts`, путь в `feedback.test.ts` (**С**, по желанию тимлида) |
| 26 | Статус загрузки данных | Одинаковый инлайн-union `"loading" \| "ready" \| "error"` в `hooks/useLessons.ts`, `services/gestureLibrary.ts`, `components/common/ContentState.tsx` (там ещё `"missing" \| "locked"`) | `LoadStatus` (`types/loading.ts`) | Сделано на шаге 5 для `useLessons.ts` и `gestureLibrary.ts`. В `ContentState.tsx` набор значений другой, остаётся свой union |
| 27 | Id пользователя в тестах | `accountId` (26 вхождений в тестах) = `User.id` | Допустимо в тестах: это id mock-аккаунта | Не требуется |

---

## 7. Что не переименовывается

Эти имена и значения — часть данных пользователей, БД, URL, CSS или закреплены тестами. Менять можно только идентификатор в коде, который на них ссылается, если значение строки остаётся прежним.

**localStorage** (префикс `rsl-trainer:v1:`, `lib/storage.ts`):
- ключи `user`, `guest`, `settings`, `learner-name:<userId>`, `recognition-tolerance`, `progress:<userId>`, `demo-result:<userId>:<sessionId>`, `pending-sync`, `preview:completed` (устаревший, только удаляется);
- поля сохранённых объектов:
  - `User`: `id`, `name`, `email`, `isGuest`, `role` (`"user" | "admin"`), `authProvider` (`"mock" | "remote"`);
  - `UserSettings`: `dominantHand`, `soundEnabled`, `speechEnabled`, `calibrationCompleted` (и удаляемое устаревшее `vibrationEnabled`);
  - `LearningProgress`: `lessons`, `sessions`, `lastLessonId`;
  - `LessonProgress`: `lessonId`, `stars`, `bestScore`, `bestAccuracy`, `completedAt`;
  - `LessonResult`: `mode`, `sessionId`, `lessonId`, `completedAt`, `score`, `accuracy`, `stars`, `durationMs`, `attempts`;
  - `GestureAttempt`: `mode`, `gestureId`, `success`, `skipped`, `confidence`, `errorCodes`, `durationMs`;
  - очередь синхронизации: `userId`, `result`;
- значения `VisionMode` (`"real"`, `"demo"`), все значения `GestureErrorCode`, значения `dominantHand` (`"right"`, `"left"`);
- ключ сессии Supabase `sb-<ref>-auth-token` задаёт библиотека.

**IndexedDB** (`lib/localDb.ts`): БД `signstep`, версия `1`, store `kv`, ключи `admin:samples` и `admin:content`, формат значений `GestureSample[]` и `Record<string, GestureContent>`.

**`public/data/samples.json`**: верхний уровень `version`, `exportedAt`, `tolerance`, `gestures`, `samples`; поля жеста `id`, `description`, `imageUrl`, `hints`; поля образца `id`, `gestureId`, `features`, `sequence`, `durationMs`, `landmarks`, `handedness`, `featureVersion`, `createdAt`. Сюда же относятся `FEATURE_VERSION`, ключи и порядок `FEATURE_LAYOUT` (`thumb.flex1` и т. д.): от них зависит совместимость записанных векторов.

**Supabase** (`supabase/`, `services/*`, `components/progress/Leaderboard.tsx`): таблицы `gesture_samples`, `gestures`, `lesson_results`, `profiles`; колонки в `SampleRow`, `GestureRow`, в объекте `upsert` и `select` из `syncService.ts` (`id`, `user_id`, `lesson_id`, `score`, `accuracy`, `stars`, `duration_ms`, `attempts`, `completed_at`, `gesture_id`, `features`, `sequence`, `handedness`, `feature_version`, `created_at`, `description`, `reference_image_url`, `hints`); RPC `get_leaderboard` с параметром `p_limit` и полями `rank`, `name`, `total_score`, `lessons_completed`, `is_me`. Переменные окружения `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RECOGNITION_TOLERANCE`.

**Маршруты** (`app/router.tsx`, значения `ROUTES` в `app/constants.ts`): `/`, `/login`, `/dashboard`, `/lessons/:lessonId`, `/lessons/:lessonId/play`, `/results/:sessionId`, `/preview`, `/preview/result`, `*`. Имена параметров `lessonId` и `sessionId` связаны с `useParams`. Ключи объекта `ROUTES` (`home`, `play`, …) внутренние, но переименовывать их незачем.

**Id и данные курса**: id жестов `letter-1`…`letter-33`, `word-<slug>` (slug `hello`, `goodbye`, …), `preview-hand`; id уроков `"1"`…`"26"` и их порядок; id разделов `alphabet`, `words`; значения `category`, `kind`, `Lesson.type` (`"learning"`, `"practice"` проверяются тестами); id и имена в `DEMO_USERS` (`mock-ruslana`, `mock-kamilla`, `mock-maria`), имя самой константы переименовать можно (строка 10 таблицы).

**Пути к ресурсам**: `/assets/gestures/<id>.svg`, `/assets/branding/*.svg`, `/models/hand_landmarker.task`, `/models/pose_landmarker_lite.task`, `/mediapipe/wasm`, `/data/samples.json`.

**CSS и разметка**: все классы из `src/styles.css`, CSS-переменные (`--color-skeleton-*`, `--node-x`, `--progress`, `--angle`, `--reach`), атрибуты `id` (`main`, `leaderboard-title`, `lesson-statistics-title`, `section-<id>`), имена полей формы (`login`, `password`, `name`, `dominant-hand`). Строковые значения, которые попадают в `className`, тоже фактически CSS: значения `RecognitionStatus` (`camera-frame ${status}`, `feedback-card ${status}`), результаты `lessonStatus` (`completed`, `current`, `available`, `locked`), `variant` у `Button` (`button--primary` …), id разделов (`path-section--alphabet`).

**Значения, закреплённые тестами**: значения `LessonPhase` (`"learn"`, `"ready"`, `"practice"`, `"prepare"`, `"transition"`, `"completed"`), типы действий редьюсера (`NEXT_THEORY`, `START_PRACTICE`, `COUNTDOWN_TICK`, `ACCEPT`, `ADVANCE`), тексты подсказок, которые проверяются регулярными выражениями (`/Выпрямите мизинец/`, `/похоже на «Б»/`), названия тестов из `.qa/baseline.md`.

**Тексты**: весь русский текст интерфейса, подсказок (`vision/hints.ts`), описаний жестов и сообщений в консоль с префиксом `[SignStep]`.

**Имена из маршрута защиты** (`README.md`, `dop/CODE_DEFENSE.md`): `normalizeHand`, `extractHandFeatures`, `compareStaticGesture`, `analyzeGestureErrors`, `recognizeFrame`, `createGestureRecognizer`, `lessonSessionReducer`, `useLessonSession`, `calculateLessonResult`, `completeLesson`, `getHandLandmarker`, `onVideoFrames`, `drawHandSkeleton`, `createSkeletonOverlay`, `recognizeVideoFrame`. Кандидатов на переименование среди них нет. Единственное имя из этих документов, которое попало в кандидаты, — `createMediaPipeVision` (строка 16 таблицы): при переименовании обновляется `CODE_DEFENSE.md`.

---

## 8. Порядок применения

1. **Без переименований** (**Н**): порядок импортов (раздел 3), кавычки (раздел 0), недостающие JSDoc (раздел 5), форма `export function` (раздел 2.5). Меняют только форму, поэтому проверка diff по п. 6 `REFACTOR_RULES.md` покажет лишь переехавшие строки.
2. **Локальные имена в одном файле** (**Н**): строки 1, 4, 5, 11, 16 (локальная `vision`), 17, 19 таблицы; константы из 2.7; булевы из 2.8; `validId` и соседние; `Row`, `Analysis`; `MIN/MAX/DEFAULT_DYNAMIC_ACCEPT` (экспортируются, но используются только в `dynamicMatcher.ts`).
3. **Экспорты, тесты, документация** (**С**): строки 6, 9, 10, 13, 15, 16 (фабрики), 18, 23, 25; `distanceToModel`, `errorLabels`, `cameraMessages`. Каждая строка таблицы делается отдельным шагом с полной проверкой.

**Отложено до этапа ООП:** `initialRecognition` → `export function` (`integrations/visionAdapter.ts`); общий хук `useRepositoryRevision` для одинаковой подписки `gestureRepository.onChange(() => setRevision(…))` в `hooks/useLessons.ts` и `services/gestureLibrary.ts`.
