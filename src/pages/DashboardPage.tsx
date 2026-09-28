import { BookOpen } from "lucide-react";
import { Page } from "../components/layout/Page";
import { LearningPath } from "../components/lessons/LearningPath";
import { ContentState } from "../components/common/ContentState";
import { useApp } from "../context/appState";
import { useLessons } from "../hooks/useLessons";

export function DashboardPage() {
  const { user, progress } = useApp();
  const { lessons, status, retry } = useLessons();
  const completed = Object.values(progress.lessons);
  const percentage = Math.round((completed.length / 20) * 100);
  return (
    <Page>
      <div className="learning-home">
        <div className="home-heading">
          <span className="eyebrow">Ваш путь в РЖЯ</span>
          <h1>
            {user?.isGuest
              ? "Добро пожаловать!"
              : `Добро пожаловать, ${user?.name.split(" ")[0]}!`}
          </h1>
          <p>
            {completed.length
              ? "Продолжим с того места, где остановились."
              : "Начнём с алфавита. Первый урок — всего пять минут."}
          </p>
          {user?.isGuest && (
            <small>Прогресс сохранится на этом устройстве.</small>
          )}
        </div>
        {completed.length > 0 ? (
          <div className="progress-summary">
            <div
              className="summary-ring"
              style={{ "--progress": `${percentage}%` } as React.CSSProperties}
            >
              <span>{percentage}%</span>
            </div>
            <div>
              <strong>Ваш прогресс</strong>
              <p>{completed.length} из 20 уроков пройдено</p>
            </div>
            <div className="summary-score">
              <strong>
                {completed.reduce((sum, item) => sum + item.bestScore, 0)}
              </strong>
              <span>очков</span>
            </div>
          </div>
        ) : (
          <div className="first-step">
            <BookOpen size={20} />
            <span>Ваш путь начинается здесь. Выберите первый урок.</span>
          </div>
        )}
        {status !== "ready" ? (
          <ContentState
            status={status}
            retry={status === "error" ? retry : undefined}
          />
        ) : (
          <LearningPath lessons={lessons} progress={progress} />
        )}
      </div>
    </Page>
  );
}
