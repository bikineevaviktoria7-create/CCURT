# SignStep: карта кода для защиты

## Архитектура за минуту

`app/router.tsx` задаёт маршруты. `pages/` и `components/` описывают экраны. `hooks/` управляют занятием и ресурсами камеры. `integrations/` соединяет видео, MediaPipe и распознаватель. В `vision/` находятся наши вычисления: нормализация, признаки, сравнение, ошибки и удержание. `services/` загружает эталоны и сохраняет данные; `data/` содержит структуру уроков. Backend и модель MediaPipe не перенесены в React-компоненты.

MediaPipe находит точки руки, а не распознаёт буквы РЖЯ. Решение о жесте и конкретной ошибке принимает наш код по записанным эталонам.

### Путь кадра и классы

```text
LessonPage / PreviewPage → PracticeGesture → useRecognition
  → createVisionAdapter → VisionAdapter (MediaPipeVisionAdapter | DemoVisionAdapter)
  → GestureRecognizer → HoldStabilizer / HintSelector / MotionSegmenter
```

| Класс / интерфейс | Файл | Ответственность |
| --- | --- | --- |
| `VisionAdapter` (интерфейс) | [types/vision.ts](../src/types/vision.ts) | Общий контракт источника результатов: поле `mode`, `initialize`, `start`, `pause`, `stop`, необязательный `simulate?`; результаты — через `VisionCallbacks`. |
| `MediaPipeVisionAdapter` | [integrations/mediaPipeVisionAdapter.ts](../src/integrations/mediaPipeVisionAdapter.ts) | Видео → MediaPipe → распознаватель → callbacks; цикл кадров и его освобождение. |
| `DemoVisionAdapter` | [integrations/demoVisionAdapter.ts](../src/integrations/demoVisionAdapter.ts) | Имитация результатов без камеры, только в режиме разработки. |
| `GestureRecognizer` (интерфейс `GestureRecognizerApi`) | [vision/recognizer.ts](../src/vision/recognizer.ts) | Одно решение по кадру: видимость, статический или движущийся жест, подсказка. |
| `HoldStabilizer` | [vision/stabilizer.ts](../src/vision/stabilizer.ts) | Успех только при удержании жеста в большинстве последних кадров. |
| `HintSelector` | [vision/stabilizer.ts](../src/vision/stabilizer.ts) | Самая частая недавняя ошибка, смена текста не чаще заданного интервала. |

**Паттерны.** «Стратегия»: оба адаптера реализуют `VisionAdapter` и взаимозаменяемы для `useRecognition`. «Фабрика»: `createVisionAdapter` в `mediaPipeVisionAdapter.ts` выбирает реализацию (демо только при `import.meta.env.DEV`, иначе MediaPipe). Тонкие фабрики `createGestureRecognizer`, `createDemoVisionAdapter`, `createMediaPipeVisionAdapter` возвращают `new` соответствующего класса.

**Зависимости.** Через конструктор приходят настройки, эталоны и callbacks; в тестах распознаватель и MediaPipe подменяются на уровне модулей (adapterLifecycle.test.ts), а сам распознаватель проверяется на синтетических эталонах (vision.test.ts). Стабилизатор, выбор подсказки и сегментатор распознаватель создаёт сам: у каждого один потребитель.

**Что осталось функциями.** Чистые функции: нормализация, признаки, расстояния, DTW, анализ ошибок, итог урока — см. таблицу ниже.

**Сервисы (O4).** Классы за интерфейсами: `SettingsService` (`SettingsStore`), `PreviewService` (`PreviewStore`), `MockAuthService` (`AuthService` в [types/auth.ts](../src/types/auth.ts)), `GestureRepository` (`GestureStore`), `ProgressService` (`ProgressStore`), `SyncService` (`SyncApi`) — в папке [services](../src/services).
Зависимости приходят через конструктор: хранилище, Supabase-клиент, `localDb`, `getCurrentUser`/`canReadProgress`, `progressService`; у `SyncService` — объектом `SyncDependencies`.
Экспорты-экземпляры сохранили имена (`settingsService`, `previewService`, `authService`, `gestureRepository`, `progressService`, `syncService`), поэтому страницы, хуки и тесты не менялись; `isRemote` и `enabled` — свойства, а не методы.
Методы, которые передаются без объекта (`get`/`subscribe` в `useSyncExternalStore`, `getCurrentUser` в `useState`, `invalidate`/`onChange`), — стрелочные поля, `this` не теряется.
Чистые функции прогресса (`calculateLessonResult`, `isPassedResult`, `streakDays`, `emptyProgress`, `lessonStatus` и др.) и `accessService` остались функциями.

**Вспомогательные объекты (O5).** `SkeletonOverlay` (`SkeletonOverlayApi { draw; dispose }`) лежит в [lib/drawHandSkeleton.ts](../src/lib/drawHandSkeleton.ts). `createSkeletonOverlay` — тонкая обёртка: проверяет video/canvas/2D-контекст до `new` и без них возвращает `undefined`. `redraw` — стрелочное поле, потому что передаётся в `ResizeObserver`. Сама `drawHandSkeleton` осталась функцией.
`SoundFeedback` (`SoundFeedbackApi`) получает настройки через конструктор, `BrowserStorage` реализует `KeyValueStorage`, префикс и `memory` у него — поля. Экспорты-экземпляры `soundFeedback` и `storage` сохранили имена, ключи хранилища не изменились.
`localDb` оставлен объектом с функциями: `set` вызывается только в тестах, и класс не дал бы выгоды для архитектуры («класс ради класса», см. `dop/OOP_PLAN.md`).

## Какие файлы открыть и в каком порядке

| № | Файл | Что показать и объяснить |
| --- | --- | --- |
| 1 | [app/router.tsx](../src/app/router.tsx) | Публичные страницы, отдельный гостевой предпросмотр, защищённые уроки. Тяжёлые страницы загружаются при переходе. |
| 2 | [hooks/useLessonSession.ts](../src/hooks/useLessonSession.ts) | `lessonSessionReducer`: вся теория → готовность → вся практика → результат. `ACCEPT` учитывает попытку один раз, `ADVANCE` после 950 мс включает подготовку следующего жеста; отсчёт 3–2–1 занимает ещё 1950 мс, и ошибки в это время не учитываются. `useLessonSession` связывает переходы с React. |
| 3 | [hooks/useCamera.ts](../src/hooks/useCamera.ts) | Запрос `getUserMedia`, ожидание готовности видео, понятные ошибки, повторный запуск и остановка всех треков. Поздний ответ запроса после выхода не оставляет камеру включённой. |
| 4 | [integrations/mediaPipeVisionAdapter.ts](../src/integrations/mediaPipeVisionAdapter.ts) | `MediaPipeVisionAdapter` и его `recognizeVideoFrame`: видео → MediaPipe → наш распознаватель → callbacks. `getHandLandmarker` в `vision/landmarkers.ts` кеширует модель; `onVideoFrames` использует видео-кадры с fallback на `requestAnimationFrame`. Результат для React ограничен 10 обновлениями/с, кроме немедленного успеха; точки напрямую рисуются на canvas. |
| 5 | [vision/normalize.ts](../src/vision/normalize.ts) | `normalizeHand`: вычитаем запястье, делим координаты на длину ладони, зеркалим левую руку. Положение и размер руки не должны менять её форму. Поворот сохраняем: он важен для различения жестов. |
| 6 | [vision/features.ts](../src/vision/features.ts) | `extractHandFeatures`: нормализованные точки → углы суставов, расстояния, разведение пальцев, ориентация ладони. `FEATURE_LAYOUT` объясняет каждую координату вектора и её вес. Версия и порядок признаков сохранены, старые эталоны совместимы. |
| 7 | [vision/staticMatcher.ts](../src/vision/staticMatcher.ts) | `weightedDistance`, `buildStaticModel`, `compareStaticGesture`: расстояние до эталонов, допустимый разброс, сравнение с другим возможным жестом. Используются два ближайших примера, а не только один. |
| 8 | [vision/errorAnalyzer.ts](../src/vision/errorAnalyzer.ts) | `analyzeGestureErrors`: сравниваем группы признаков с ближайшим эталоном целевого жеста. Значимое отклонение превращаем в конкретную подсказку и номера точек для подсветки. Пороги учитывают естественный разброс записей. |
| 9 | [vision/recognizer.ts](../src/vision/recognizer.ts) | `GestureRecognizer`: `recognizeFrame`, `recognizeStaticHand`, `recognizeMovement` собирают все этапы в одно решение. Сначала проверяем видимость и окружение. Стабилизатор не допускает успеха от случайного удачного кадра; уже принятое выполнение повторно не засчитывается. |
| 10 | [services/progressService.ts](../src/services/progressService.ts) | `calculateLessonResult` считает результат; `completeLesson` проверяет данные, исключает повторы, сохраняет прогресс через `storage` и возвращает его для обновления UI. Demo-результаты и незачтённые уроки не становятся настоящим прогрессом. |

Вспомогательные файлы, появившиеся при унификации:

- `hooks/useLatestRef.ts` — ref со значением из последнего рендера для ранее созданных callbacks (`useRecognition`, `AppProvider`, `Modal`).
- `hooks/useCompletionSound.ts` — один звук при появлении результата: праздничный при зачёте, нейтральный при незачёте (`ResultsPage`, `PreviewPage`).
- `hooks/useRouteLesson.ts` — уроки, прогресс и урок из параметра маршрута `:lessonId` (`LessonOverviewPage`, `LessonPage`).
- `hooks/useStartPreview.ts` — действие «гостевой вход и переход к предпросмотру» (`LandingPage`, `AuthPage`).
- `components/lessons/SectionTitle.tsx` — название раздела урока из `lessonSections`.

## Правило оценки урока

`calculateLessonResult` в [services/progressService.ts](../src/services/progressService.ts) переводит точность в звёзды:

| Точность | Звёзды | Урок |
| --- | ---: | --- |
| < 40% | 0 | не засчитан |
| 40–69% | 1 | засчитан |
| 70–89% | 2 | засчитан |
| ≥ 90% | 3 | засчитан |

`isPassedResult` считает урок пройденным только при звёздах > 0. `completeLesson` сохраняет незачтённый результат отдельно, лишь для страницы результата: он не попадает в прогресс, не открывает следующий урок и не продлевает серию. Пороги проверяет `dop/tests/failedLesson.test.ts`.

Собственная логика распознавания для демонстрации — прежде всего `normalizeHand`, `extractHandFeatures`, `compareStaticGesture`, `analyzeGestureErrors` и `recognizeFrame`.

Для вопросов жюри:

- **Удержание:** `vision/stabilizer.ts` — совпадения в скользящем окне и время стабильности; фильтрация смены подсказок.
- **Canvas:** `lib/drawHandSkeleton.ts` — `drawHandSkeleton` и общий `createSkeletonOverlay`, масштабирование, зеркальность, подсветка и отключение наблюдения за размером.
- **Эталоны:** `services/gestureLibrary.ts` загружает записи и строит модели; `gestureRepository.ts` сохраняет существующие локальный и сетевой пути.
- **Сохранение:** `context/AppProvider.tsx` получает новый прогресс и обновляет React. Существующий `syncService.ts` сохраняет сетевую очередь для серверной авторизации; в текущем mock-входе она отключена.

## Что упростилось

- Адаптеры и распознаватель — классы за интерфейсами `VisionAdapter` и `GestureRecognizerApi`; списков подписчиков нет, у каждого один потребитель.
- Точки передаются напрямую в callback: убрана лишняя оболочка кадра и дублирующий тип точки. Данные каждого кадра по-прежнему не попадают в React state.
- Подготовка canvas для занятия находится в одном месте.
- Редьюсер и hook занятия объединены. Удалено неиспользуемое время начала жеста, идентификатор сессии создаётся один раз.
- Загрузка уроков объединена с единственным использующим её hook. Убран интерфейс репозитория без альтернативной реализации.
- Загрузка CV-эталонов и её hook объединены в `gestureLibrary.ts`; название больше не напоминает React Context.
- Удалены неиспользуемые `Card` и `cn`. Маленькая функция серии занятий перенесена к прогрессу.

## Что сохранено намеренно

Математика и пороги признаков, нормализация, стабилизация, приоритеты ошибок, тексты подсказок и формат эталонов сохранены. Редьюсер оставлен: он явно запрещает неправильный порядок занятия. Защита от поздних async-ответов, кеш моделей, освобождение камеры и циклов не сокращены. Валидация localStorage, IndexedDB, варианты авторизации и очередь синхронизации решают реальные задачи, поэтому их не заменяли упрощёнными заглушками. Дизайн, CSS, анимации и действующие правила доступа не переделывались.

## Размер изменений

Сравниваются тег `before-refactor` (до унификации) и текущий `HEAD`. Подсчёт включает `.ts`, `.tsx`, `.css` внутри `src`, включая комментарии и пустые строки; не включает тесты, документацию, зависимости и сборку. Как считалось: список файлов — `git ls-tree -r --name-only <ref> -- src` с фильтром по расширению, строки — `git show <ref>:<файл> | wc -l`, суммируются по всем файлам.

| | До (`before-refactor`) | После (`HEAD`) |
| --- | ---: | ---: |
| Исходные файлы | 67 | 73 |
| Строки | 8 114 | 8 298 |
| `src/styles.css`, строк | 2 199 | 2 206 |

Файлов и строк стало больше: общие части вынесены в отдельные hooks и компоненты (см. список выше), а в код добавлено правило незачтённого урока.

Удалено зависимостей: **0**. Установленные библиотеки используются; удалять их ценой переписывания работающих возможностей не нужно. Основной результат — меньше переходов между файлами и проще путь от кадра к подсказке, а не минимальный размер любой ценой.

## Границы проверки распознавания

Поведение распознавания закреплено автотестами `npm test` на синтетических landmarks: `dop/tests/vision.test.ts` (признаки, kNN, анализ ошибок, удержание, DTW) и `dop/tests/previewRecognition.test.ts` (успех только по наблюдаемым точкам, отказ без эталонов).

Это проверка сохранения поведения, а не измерение точности на реальных исполнителях РЖЯ. Проверенные медиа и эталоны пока отсутствуют в репозитории. Их отсутствие остаётся видимым состоянием интерфейса и не подменяется случайным успехом. Изменение алгоритма и сбор датасета не входят в этот рефакторинг.
