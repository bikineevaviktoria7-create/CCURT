import { Check, LockKeyhole, Play, RotateCcw, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { lessonSections } from "../../data/lessons";
import { ROUTES } from "../../app/constants";
import { lessonStatus } from "../../services/progressService";
import type { Lesson } from "../../types/lesson";
import type { LearningProgress } from "../../types/progress";

const offsets = [0, -45, 0, 45];
function lessonsCount(count: number) {
  const tens = count % 100;
  const ones = count % 10;
  const word = tens >= 11 && tens <= 14 ? "уроков" : ones === 1 ? "урок" : ones >= 2 && ones <= 4 ? "урока" : "уроков";
  return `${count} ${word}`;
}

export function LearningPath({
  lessons,
  progress,
}: {
  lessons: readonly Lesson[];
  progress: LearningProgress;
}) {
  return (
    <div className="learning-path">
      {lessonSections.map((section) => {
        const items = lessons.filter(
          (lesson) => lesson.sectionId === section.id,
        );
        return (
          <section
            className="path-section"
            key={section.id}
            aria-labelledby={`section-${section.id}`}
          >
            <div className="path-section-heading">
              <span className="section-number">0{section.number}</span>
              <div>
                <p className="eyebrow">{lessonsCount(items.length)} · шаг за шагом</p>
                <h2 id={`section-${section.id}`}>
                  {section.id === "alphabet"
                    ? "Изучение алфавита"
                    : section.title}
                </h2>
                <p>{section.description}</p>
              </div>
            </div>
            <ol className="path-nodes">
              {items.map((lesson, index) => {
                const status = lessonStatus(lesson, lessons, progress);
                const x = 80 + (offsets[index % offsets.length] ?? 0);
                const nextX = 80 + (offsets[(index + 1) % offsets.length] ?? 0);
                const repetition = section.id === "alphabet" && index === 5;
                const moreLetters = section.id === "alphabet" && index === 10;
                const contents = (
                  <>
                    <span className={`lesson-circle ${status}`}>
                      {status === "completed" ? (
                        <Check size={26} />
                      ) : status === "locked" ? (
                        <LockKeyhole size={21} />
                      ) : (
                        <Play size={24} fill="currentColor" />
                      )}
                    </span>
                    <span className="node-copy">
                      <span className="node-kicker">
                        Урок {lesson.number}
                        {lesson.type === "practice" && (
                          <RotateCcw size={13} aria-label="Повторение" />
                        )}
                      </span>
                      <strong>{lesson.title}</strong>
                      <span>
                        {lesson.type === "practice"
                          ? "Закрепляем изученное"
                          : lesson.gestures
                              .map((gesture) => gesture.label)
                              .join(" · ")}
                      </span>
                      {status === "current" && (
                        <span className="current-caption">Начать урок →</span>
                      )}
                      {status === "completed" && (
                        <span
                          className="node-stars"
                          role="img"
                          aria-label={`${progress.lessons[lesson.id]?.stars} из 3 звёзд`}
                        >
                          {[1, 2, 3].map((value) => (
                            <Star
                              key={value}
                              size={13}
                              fill={
                                value <=
                                (progress.lessons[lesson.id]?.stars ?? 0)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          ))}
                        </span>
                      )}
                    </span>
                  </>
                );
                return (
                  <li
                    key={lesson.id}
                    className={`path-item ${repetition || moreLetters ? "repetition-start" : ""}`}
                  >
                    {repetition && (
                      <span className="repetition-label">
                        Теперь закрепим знания
                      </span>
                    )}
                    {moreLetters && (
                      <span className="repetition-label">
                        Остальные буквы алфавита
                      </span>
                    )}
                    {index < items.length - 1 && (
                      <svg
                        className={`path-connector ${status === "completed" ? "is-completed" : ""}`}
                        viewBox="0 0 160 154"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path
                          d={`M ${x} 39 C ${x} 100, ${nextX} 70, ${nextX} 193`}
                        />
                      </svg>
                    )}
                    <div
                      className="node-offset"
                      style={{ "--node-x": `${x}px` } as React.CSSProperties}
                    >
                      {status === "locked" ? (
                        <button
                          className="lesson-node"
                          disabled
                          aria-label={`Урок ${lesson.number}: ${lesson.title}. Сначала завершите предыдущие уроки.`}
                        >
                          {contents}
                        </button>
                      ) : (
                        <Link
                          to={ROUTES.lesson(lesson.id)}
                          className="lesson-node"
                          aria-current={
                            status === "current" ? "step" : undefined
                          }
                        >
                          {contents}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <div className="path-finish">
        <Star size={21} />
        <p>{lessons.length} шагов к большему пониманию</p>
      </div>
    </div>
  );
}
