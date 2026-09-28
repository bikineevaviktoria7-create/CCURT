import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { useApp } from "../context/appState";
import { authService } from "../services/authService";
import { ROUTES } from "../app/constants";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const register = mode === "register";
  if (user && !user.isGuest) return <Navigate to={ROUTES.dashboard} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();
    setError("");
    if (register && name.split(/\s+/).length < 2) {
      setError("Укажите имя и фамилию.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Введите корректный email.");
      return;
    }
    if (!password || (register && password.length < 8)) {
      setError(
        register
          ? "Пароль должен содержать не менее 8 символов."
          : "Введите пароль.",
      );
      return;
    }
    if (register && password !== data.get("confirmation")) {
      setError("Пароли не совпадают.");
      return;
    }
    setLoading(true);
    try {
      if (register) {
        await authService.register({ name, email, password });
        navigate(ROUTES.verifyEmail);
      } else {
        const next = await authService.login({ email, password });
        if (next) setUser(next);
        navigate(next ? ROUTES.dashboard : ROUTES.verifyEmail);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось войти. Попробуйте снова.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <Page compact>
      <Link className="back-link" to={ROUTES.home}>
        <ArrowLeft size={17} />К началу
      </Link>
      <section className="auth-card card">
        <span className="eyebrow">Ваш следующий шаг</span>
        <h1>{register ? "Регистрация" : "С возвращением!"}</h1>
        <p>
          {register
            ? "Создайте аккаунт, чтобы сохранять свои занятия."
            : "Войдите, чтобы продолжить обучение."}
        </p>
        <form
          noValidate
          onSubmit={submit}
          className="form-stack"
          aria-label={register ? "Регистрация" : "Вход"}
        >
          {register && (
            <label>
              Имя и фамилия
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={80}
                placeholder="Алекс Иванов"
              />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={150}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 8 : 1}
              maxLength={128}
              aria-describedby={register ? "password-hint" : undefined}
            />
          </label>
          {register && (
            <>
              <small id="password-hint">Не менее 8 символов.</small>
              <label>
                Повторите пароль
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button loading={loading} type="submit" fullWidth>
            {register ? "Зарегистрироваться" : "Войти"}
          </Button>
        </form>
        <p className="auth-switch">
          {register ? "Уже есть аккаунт?" : "Первый раз здесь?"}{" "}
          <Link
            className="text-link"
            to={register ? ROUTES.login : ROUTES.register}
          >
            {register ? "Войти" : "Зарегистрироваться"}
          </Link>
        </p>
        <button
          className="text-link guest-link"
          onClick={() => {
            setUser(authService.guest());
            navigate(ROUTES.dashboard);
          }}
        >
          Попробовать без регистрации
        </button>
        <p className="demo-note">
          Демо-аккаунт хранится только в этом браузере. Отправка email пока не
          подключена.
        </p>
      </section>
    </Page>
  );
}
