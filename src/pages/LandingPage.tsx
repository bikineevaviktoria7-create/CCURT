import { ArrowRight, ScanLine, ShieldCheck, MoveUpRight } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { useApp } from "../context/appState";
import { authService } from "../services/authService";
import { APP_NAME, ROUTES } from "../app/constants";

export function LandingPage() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const start = () => {
    setUser(authService.guest());
    navigate(ROUTES.preview);
  };
  if (user && !user.isGuest) return <Navigate to={ROUTES.dashboard} replace />;
  return (
    <Page>
      <section className="landing">
        <div className="landing-copy">
          <span className="eyebrow landing-kicker">Русский жестовый язык · РЖЯ</span>
          <h1>
            Новый язык.
            <br />
            <span className="text-primary">Ближе друг к другу.</span>
          </h1>
          <p className="lead">
            Изучайте русский жестовый язык шаг за шагом. Покажите жест в камеру
            — {APP_NAME} подскажет, что именно нужно исправить.
          </p>
          <Button
            onClick={() => navigate(ROUTES.login)}
          >
            Начать обучение
            <ArrowRight size={20} aria-hidden="true" />
          </Button>
          <div className="landing-links">
            <Link to={ROUTES.login}>Войти</Link>
            <Link to={ROUTES.register}>Зарегистрироваться</Link>
            <button onClick={start}>Предпросмотр</button>
          </div>
          <p className="privacy">
            <ShieldCheck size={18} aria-hidden="true" />
            Видео обрабатывается на вашем устройстве.
          </p>
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
              <p>Вы видите, что именно нужно исправить.</p>
            </div>
          </div>
          <ol className="preview-steps" aria-label="Как проходит обучение">
            <li><span>01</span> Изучите</li>
            <li><span>02</span> Покажите</li>
            <li><span>03</span> Исправьте</li>
          </ol>
        </div>
      </section>
    </Page>
  );
}
