import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { GestureReference } from "../components/lessons/GestureReference";
import { PracticeGesture } from "../components/camera/PracticeGesture";
import { previewExercise, previewService } from "../services/previewService";
import { ROUTES } from "../app/constants";
import type { GestureAttempt } from "../types/progress";

export function PreviewPage() {
  const [phase, setPhase] = useState<"learn" | "practice" | "success">("learn");
  const accepted = useRef<GestureAttempt | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (phase !== "success") return;
    const timer = window.setTimeout(() => {
      if (accepted.current) previewService.complete(accepted.current);
      navigate(ROUTES.previewResult, { replace: true });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [phase, navigate]);
  if (previewService.getResult()) return <Navigate to={ROUTES.previewResult} replace />;
  return <Page>
    <div className="action-row"><Link to={ROUTES.home} className="text-link">← На начальную</Link><span className="eyebrow">Предпросмотр · 1 / 1</span></div>
    {phase === "learn" ? <section className="learn-screen">
      <div className="learn-intro"><h1>Попробуйте камеру и подсказки</h1><p>Одно тестовое упражнение. Проверяем видимость руки без оценки жеста РЖЯ.</p></div>
      <div className="learn-card card">
        <GestureReference gesture={previewExercise} />
        <div className="learn-description"><h2>{previewExercise.title}</h2><p>{previewExercise.description}</p><Button onClick={() => setPhase("practice")}>Начать практику</Button></div>
      </div>
    </section> : <PracticeGesture gesture={previewExercise} exercise="hand-visibility" paused={false}
      transitioning={phase === "success"} onAccept={(attempt) => {
        if (accepted.current) return;
        accepted.current = attempt;
        setPhase("success");
      }} />}
    <p className="privacy"><Link to={ROUTES.login} className="text-link">Войти и открыть все уроки</Link></p>
  </Page>;
}

export function PreviewResultPage() {
  const result = previewService.getResult();
  if (!result) return <Navigate to={ROUTES.preview} replace />;
  return <Page compact>
    <section className="practice-ready">
      <span className="ready-icon"><Check size={34} /></span>
      <span className="eyebrow">Предпросмотр · 1 / 1</span>
      <h1>Тест завершён</h1>
      <p>Камера обнаружила вашу руку и проверила удержание в кадре. Это тест работы камеры, а не оценка знания РЖЯ.</p>
      <p>Предпросмотр пройден. Войдите, чтобы открыть все уроки.</p>
      <Link className="button button--primary" to={ROUTES.login}>Войти</Link>
      <Link className="text-link" to={ROUTES.register}>Регистрация / временный вход</Link>
      <Link className="text-link" to={ROUTES.home}>На начальную</Link>
    </section>
  </Page>;
}
