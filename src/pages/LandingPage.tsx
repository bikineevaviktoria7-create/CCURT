import { StudentVideos } from "../components/landing/StudentVideos";
import { ArrowRight, ScanLine, MoveUpRight } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { useApp } from "../context/appState";
import { useStartPreview } from "../hooks/useStartPreview";
import { ROUTES } from "../app/constants";

export function LandingPage() {
  const { user } = useApp();
  const navigate = useNavigate();
  const start = useStartPreview();
  if (user && !user.isGuest) return <Navigate to={ROUTES.dashboard} replace />;
  return (
    <Page>
      <section className="landing">
        <div className="landing-copy">
          <span className="eyebrow landing-kicker">Русский жестовый язык</span>
          <h1>
            Жесты, которые
            <br />
            <span className="text-primary">становятся понятными</span>
          </h1>
          <p className="lead">
            Изучайте жестовый язык и сразу практикуйтесь с помощью камеры
          </p>
          <Button
            onClick={() => navigate(ROUTES.login)}
          >
            Начать обучение
            <ArrowRight size={20} aria-hidden="true" />
          </Button>
          <div className="landing-links">
            <Link to={ROUTES.login}>Войти</Link>
            <button onClick={start}>Предпросмотр</button>
          </div>
        </div>
        <div
          className="landing-preview"
          aria-label="Пример интерфейса распознавания, не эталон жеста"
        >
          <div className="row-between">
            <span className="eyebrow">Учимся замечать детали</span>
            <ScanLine size={22} className="text-primary" aria-hidden="true" />
          </div>
          <div className="preview-window">
            <span className="preview-label">Буква А</span>
            <img className="preview-reference" src="/assets/gestures/letter-1.svg" alt="Иллюстрация буквы А из урока" />
            <span className="preview-corner top-left" />
            <span className="preview-corner bottom-right" />
            <p>Пример учебного экрана</p>
          </div>
          <div className="preview-feedback">
            <span className="preview-feedback-icon"><MoveUpRight size={24} aria-hidden="true" /></span>
            <div>
              <span className="preview-feedback-label">Например, такая подсказка</span>
              <strong>Поверните ладонь к камере</strong>
              <p>Вы видите, что именно нужно исправить</p>
            </div>
          </div>
          <ol className="preview-steps" aria-label="Как проходит обучение">
            <li><span>01</span> Изучите</li>
            <li><span>02</span> Покажите</li>
            <li><span>03</span> Исправьте</li>
          </ol>
        </div>
      </section>
      <StudentVideos />
    </Page>
  );
}
