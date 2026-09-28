import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, Clock3, Layers3, TriangleAlert } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Logo } from '../components/common/Logo';
import { GestureReference } from '../components/lessons/GestureReference';
import { lessonService } from '../services/lessonService';
import type { Lesson, SectionId } from '../types/lesson';

type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; lessons: readonly Lesson[] }
  | { status: 'error' };

export function FoundationPage() {
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [section, setSection] = useState<SectionId>('alphabet');
  const [retry, setRetry] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    lessonService.getLessons().then(
      (lessons) => { if (active) setCatalog({ status: 'ready', lessons }); },
      () => { if (active) setCatalog({ status: 'error' }); },
    );
    return () => { active = false; };
  }, [retry]);

  const lesson = catalog.status === 'ready' ? catalog.lessons.find((item) => item.sectionId === section) : undefined;
  const gesture = lesson?.gestures[0];

  return (
    <div className="foundation-page">
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <header className="site-header page-container">
        <Logo />
        <span className="header-description">Русский жестовый язык</span>
        <span className="stage-badge"><span aria-hidden="true" /> Этап 01 <span className="hidden sm:inline">· Основа</span></span>
      </header>

      <main id="main" className="page-container" tabIndex={-1}>
        <motion.section
          className="foundation-intro"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="intro-copy">
            <span className="eyebrow"><span className="eyebrow-line" /> Маленькие шаги. Больше понимания.</span>
            <h1>Новый язык.<br /><span className="text-primary">Ближе друг к другу.</span></h1>
            <p className="intro-description">Спокойное пространство для изучения РЖЯ — с понятными подсказками и вниманием к каждому движению.</p>
            <div className="foundation-note">
              <Layers3 size={20} className="shrink-0 text-primary" aria-hidden="true" />
              <p><strong>Начинаем с основы</strong><br />Это проверочный экран интерфейса. Обучение, камера и вход появятся на следующих этапах.</p>
            </div>
            <div className="catalog-summary" aria-label="Структура учебной программы">
              <div><strong>02</strong><span>раздела</span></div>
              <div><strong>{catalog.status === 'ready' ? catalog.lessons.length : '—'}</strong><span>уроков в программе</span></div>
              <div><strong>~5 <small>мин</small></strong><span>на небольшой шаг</span></div>
            </div>
          </div>

          <Card className="material-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="eyebrow">Учебный материал</span>
              <span className="small-badge">Предпросмотр</span>
            </div>
            {catalog.status === 'loading' && <p className="py-16 text-center text-text-secondary" role="status">Подготавливаем материалы…</p>}
            {catalog.status === 'error' && (
              <div className="space-y-4 py-8" role="alert">
                <p>Не удалось загрузить материалы.</p>
                <Button onClick={() => { setCatalog({ status: 'loading' }); setRetry((value) => value + 1); }}>Попробовать снова</Button>
              </div>
            )}
            {lesson && gesture && (
              <>
                <div className="material-heading" aria-live="polite" aria-atomic="true">
                  <p>{section === 'alphabet' ? 'Алфавит' : 'Основные слова'} <span aria-hidden="true">/</span> Урок {lesson.number}</p>
                  <h2>{lesson.title}</h2>
                </div>
                <GestureReference gesture={gesture} />
                <div className="material-meta">
                  <span><BookOpen size={16} aria-hidden="true" />{lesson.gestures.map((item) => item.label).join(' · ')}</span>
                  <span><Clock3 size={16} aria-hidden="true" />~{lesson.estimatedMinutes} минут</span>
                </div>
                <Button fullWidth variant="secondary" onClick={() => setSection(section === 'alphabet' ? 'words' : 'alphabet')}>
                  {section === 'alphabet' ? 'Посмотреть основные слова' : 'Вернуть алфавит'}
                  {section === 'alphabet' ? <ArrowRight size={18} aria-hidden="true" /> : <ArrowLeft size={18} aria-hidden="true" />}
                </Button>
              </>
            )}
          </Card>
        </motion.section>

        <section className="design-section" aria-labelledby="design-heading">
          <div className="design-section-heading">
            <div><span className="eyebrow">Единый визуальный язык</span><h2 id="design-heading">Понятно с первого взгляда</h2></div>
            <p>Текст, форма и цвет работают вместе.</p>
          </div>
          <div className="foundation-grid">
            <Card className="principle-card">
              <span className="principle-index">01 / Оформление</span>
              <h3>Меньше шума, больше внимания</h3>
              <p>Тёплый фон, спокойный фиолетовый и свободное пространство.</p>
              <div className="palette" aria-label="Цвета интерфейса">
                <span className="bg-primary" title="Основной фиолетовый" />
                <span className="bg-primary-soft" title="Мягкая лаванда" />
                <span className="bg-background" title="Тёплый белый" />
                <span className="bg-text-primary" title="Основной текст" />
              </div>
            </Card>
            <Card className="principle-card">
              <span className="principle-index">02 / Обратная связь</span>
              <h3>Состояния, которые легко читать</h3>
              <p>Важная информация всегда видна, даже когда звук выключен.</p>
              <div className="feedback-samples">
                <span className="status-pill status-pill--success"><CircleCheck size={16} aria-hidden="true" />Отлично!</span>
                <span className="status-pill status-pill--warning"><TriangleAlert size={16} aria-hidden="true" />Почти получилось</span>
              </div>
            </Card>
            <Card className="principle-card">
              <span className="principle-index">03 / Материалы</span>
              <h3>Знания начинаются с доверия</h3>
              <p>Только проверенные эталоны РЖЯ. До их добавления — честные заглушки.</p>
              <span className="inline-note"><Check size={17} aria-hidden="true" />Никаких выдуманных жестов</span>
            </Card>
          </div>
        </section>
      </main>
      <footer className="site-footer page-container"><span>Каждый шаг помогает понимать друг друга.</span><span>Основа интерфейса · 01 / 12</span></footer>
    </div>
  );
}
