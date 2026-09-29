import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { useApp } from "../context/appState";
import { authService } from "../services/authService";
import { MOCK_CREDENTIALS, ROUTES } from "../app/constants";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user && !user.isGuest) return <Navigate to={ROUTES.dashboard} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setLoading(true);
    try {
      const next = await authService.login({ email: String(data.get("login") ?? ""), password: String(data.get("password") ?? "") });
      if (next) { setUser(next); navigate(ROUTES.dashboard); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось войти. Попробуйте снова.");
    } finally { setLoading(false); }
  }
  return (
    <Page compact>
      <Link className="back-link" to={ROUTES.home}><ArrowLeft size={17} />К началу</Link>
      <section className="auth-card card">
        <span className="eyebrow">Ваш следующий шаг</span>
        <h1>Войти в обучение</h1>
        <p>{mode === "register" ? "Регистрация пока недоступна. Войдите в тестовый аккаунт." : "Для знакомства с платформой доступен тестовый вход."}</p>
        <form onSubmit={submit} className="form-stack" aria-label="Вход">
          <label>Имя / логин<input name="login" autoComplete="username" required maxLength={80} /></label>
          <label>Пароль<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button loading={loading} type="submit" fullWidth>Войти</Button>
        </form>
        <p className="demo-note">Тестовый логин: <strong>{MOCK_CREDENTIALS.login}</strong><br />Пароль: <strong>{MOCK_CREDENTIALS.password}</strong></p>
        <button className="text-link guest-link" onClick={() => { setUser(authService.guest()); navigate(ROUTES.preview); }}>Предпросмотр</button>
      </section>
    </Page>
  );
}
