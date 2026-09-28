import { ArrowRight, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
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
    navigate(ROUTES.dashboard);
  };
  if (user) return <Navigate to={ROUTES.dashboard} replace />;
  return (
    <Page>
      <section className="landing">
        <div className="landing-copy">
          <span className="eyebrow">Учиться понимать друг друга</span>
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
            onClick={start}
            icon={<ArrowRight size={20} aria-hidden="true" />}
          >
            Начать обучение
          </Button>
          <div className="landing-links">
            <Link to={ROUTES.register}>Зарегистрироваться</Link>
            <button onClick={start}>Попробовать без регистрации</button>
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
            <span className="eyebrow">От движения к пониманию</span>
            <ScanLine size={22} className="text-primary" />
          </div>
          <div className="preview-window">
            <span className="preview-label">Покажите жест</span>
            <span className="preview-letter">А</span>
            <span className="preview-corner top-left" />
            <span className="preview-corner bottom-right" />
            <p>Изучите → попробуйте → исправьте</p>
          </div>
          <div className="preview-feedback">
            <Sparkles size={24} aria-hidden="true" />
            <div>
              <strong>Важна каждая деталь</strong>
              <p>Понятная подсказка и подсветка ошибки на руке.</p>
            </div>
          </div>
          <p className="preview-note">
            Сейчас доступна демонстрация. Распознавание и эталоны РЖЯ ещё
            готовятся.
          </p>
        </div>
      </section>
    </Page>
  );
}
