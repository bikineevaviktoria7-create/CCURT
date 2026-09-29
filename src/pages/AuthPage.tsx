import { uiText } from "../lib/uiText";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { useApp } from "../context/appState";
import { authService } from "../services/authService";
import { DEMO_PASSWORD, DEMO_USERS, ROUTES } from "../app/constants";

export function AuthPage() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
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
      setError(cause instanceof Error ? cause.message : "Не удалось войти. Попробуйте снова");
    } finally { setLoading(false); }
  }
  return (
    <Page compact>
      <Link className="back-link" to={ROUTES.home}><ArrowLeft size={17} />К началу</Link>
      <section className="auth-card card">
        <span className="auth-icon"><LogIn size={25} aria-hidden="true" /></span>
        <span className="eyebrow">Ваш следующий шаг</span>
        <h1>Войти в обучение</h1>
        <p>Продолжайте изучать жесты в своём темпе</p>
        <form onSubmit={submit} className="form-stack" aria-label="Вход">
          <label>Имя / логин<input name="login" autoComplete="username" placeholder="Введите логин" required maxLength={80} /></label>
          <div className="password-field">
            <label htmlFor="login-password">Пароль</label>
            <div className="password-control">
              <input id="login-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" placeholder="Введите пароль" required maxLength={128} />
              <button type="button" className="password-toggle" aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={passwordVisible} onClick={() => setPasswordVisible(!passwordVisible)}>
                {passwordVisible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            </div>
          </div>
          {error && <p className="form-error" role="alert">{uiText(error)}</p>}
          <Button loading={loading} type="submit" fullWidth>Войти</Button>
        </form>
        <div className="demo-note"><p>{DEMO_USERS.map(user => user.name).join(" · ")}</p><p>Пароль для всех: <code>{DEMO_PASSWORD}</code></p></div>
        <button className="text-link guest-link" onClick={() => { setUser(authService.guest()); navigate(ROUTES.preview); }}>Предпросмотр</button>
      </section>
    </Page>
  );
}
