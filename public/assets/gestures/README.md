# Проверенные материалы РЖЯ

В репозитории нет проверенных медиа и обучающих CV-образцов. В public/data/samples.json массивы gestures и samples пусты. Модели MediaPipe обнаруживают руку, но сами по себе не распознают РЖЯ.

## Как добавить

После проверки специалистом положите материалы в эту папку, например letter-1.webp, word-hello.mp4. Добавьте соответствующий ID в src/data/gestureReferences.ts:

```ts
"letter-1": { kind: "image", src: "/assets/gestures/letter-1.webp", alt: "Проверенный эталон буквы А" }
// kind: image | gif | video; у video можно задать poster
```

Компонент GestureReference используется в теории, практике и модальном повторе. Он поддерживает отложенную загрузку, controls/playsInline для видео и placeholder при ошибке загрузки. Изображение не является CV-образцом: отдельно нужны проверенные features/sequence в samples.json.

## Отсутствуют: 48 из 48

| ID | Буква / слово |
|---|---|
| letter-1 | А |
| letter-2 | Б |
| letter-3 | В |
| letter-4 | Г |
| letter-5 | Е |
| letter-6 | И |
| letter-7 | Л |
| letter-8 | М |
| letter-9 | Н |
| letter-10 | О |
| letter-11 | П |
| letter-12 | С |
| letter-13 | Т |
| letter-14 | У |
| letter-15 | Ш |
| letter-16 | Д |
| letter-17 | Ё |
| letter-18 | Ж |
| letter-19 | З |
| letter-20 | Й |
| letter-21 | К |
| letter-22 | Р |
| letter-23 | Ф |
| letter-24 | Х |
| letter-25 | Ц |
| letter-26 | Ч |
| letter-27 | Щ |
| letter-28 | Ъ |
| letter-29 | Ы |
| letter-30 | Ь |
| letter-31 | Э |
| letter-32 | Ю |
| letter-33 | Я |
| word-hello | Привет |
| word-goodbye | До свидания |
| word-yes | Да |
| word-no | Нет |
| word-thanks | Спасибо |
| word-please | Пожалуйста |
| word-sorry | Извините |
| word-name | Имя |
| word-me | Я |
| word-you | Вы |
| word-help | Помощь |
| word-repeat | Повторите |
| word-understand | Понимать |
| word-home | Дом |
| word-water | Вода |

Схема public/assets/branding/camera-zone.svg относится только к тесту видимости руки. Это не изображение жеста РЖЯ.
