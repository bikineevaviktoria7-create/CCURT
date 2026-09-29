import { BookOpen, Flame } from "lucide-react";
import { ProgressChart } from "../components/progress/ProgressChart";
import { streakDays } from "../services/progressService";
import { Leaderboard } from "../components/progress/Leaderboard";
import { SettingsPanel } from "../components/common/SettingsPanel";
import { Page } from "../components/layout/Page";
import { LearningPath } from "../components/lessons/LearningPath";
import { ContentState } from "../components/common/ContentState";
import { useApp } from "../context/appState";
import { useLessons } from "../hooks/useLessons";

export function DashboardPage() {
  const { user, progress } = useApp();
  const { lessons, status, retry } = useLessons();
  const completed = Object.values(progress.lessons);
  const total = lessons.length || 20;
  const percentage = Math.round((completed.length / total) * 100);
  const streak = streakDays(progress.sessions);
  return (
    <Page>
      <div className="learning-home">
        <div className="home-heading">
          <span className="eyebrow">Изучаем русский жестовый язык</span>
          <h1>
            {user?.isGuest
              ? "Добро пожаловать!"
              : `Добро пожаловать, ${user?.name.split(" ")[0]}!`}
          </h1>
          <p>
            {completed.length
              ? "Продолжим с того места, где остановились"
              : "Начнём с алфавита. Первый урок – всего пять минут"}
          </p>
          {user?.isGuest && (
            <small>Прогресс сохранится на этом устройстве</small>
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
              <p>
                {completed.length} из {total} уроков пройдено
              </p>
              {streak > 0 && (
                <p className="streak">
                  <Flame size={16} aria-hidden="true" /> {streak}{" "}
                  {streak === 1 ? "день" : streak < 5 ? "дня" : "дней"} подряд
                </p>
              )}
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
            <span>Ваш путь начинается здесь. Выберите первый урок</span>
          </div>
        )}
        {completed.length > 0 && (
          <section className="lesson-statistics" aria-labelledby="lesson-statistics-title">
            <h2 id="lesson-statistics-title">Статистика занятий</h2>
            <div className="progress-insights">
              <div className="card chart-card">
                <ProgressChart sessions={progress.sessions} />
              </div>
              <Leaderboard refreshKey={progress.sessions.length} />
            </div>
          </section>
        )}
        <SettingsPanel />
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
