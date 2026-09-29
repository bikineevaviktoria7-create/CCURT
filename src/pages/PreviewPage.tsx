import { feedback } from "../lib/feedback";
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
      <div className="learn-intro"><h1>Попробуйте камеру и подсказки</h1><p>Покажите руку и удерживайте её в кадре</p></div>
      <div className="learn-card card">
        <GestureReference gesture={previewExercise} />
        <div className="learn-description"><h2>{previewExercise.title}</h2><p>Поднимите одну руку так, чтобы запястье и все пальцы были видны. Удерживайте её в центре кадра до заполнения кольца</p><Button onClick={() => setPhase("practice")}>Начать практику</Button></div>
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
  const completionSoundPlayed = useRef(false);
  useEffect(() => {
    if (result && !completionSoundPlayed.current) {
      completionSoundPlayed.current = true;
      feedback.lessonComplete();
    }
  }, [result]);
  if (!result) return <Navigate to={ROUTES.preview} replace />;
  return <Page>
    <section className="practice-ready preview-result">
      <span className="ready-icon"><Check size={34} /></span>
      <span className="eyebrow">Предпросмотр · 1 / 1</span>
      <h1>Упражнение завершено</h1>
      <p>Вы удержали руку в кадре! Теперь можно перейти к изучению жестов</p>
      <p>Предпросмотр пройден. Войдите, чтобы открыть все уроки</p>
      <Link className="button button--primary" to={ROUTES.login}>Войти и открыть все уроки</Link>
      <Link className="text-link" to={ROUTES.home}>На начальную</Link>
    </section>
  </Page>;
}
