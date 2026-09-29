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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const isRegister = mode === "register";

  if (user && !user.isGuest) return <Navigate to={ROUTES.dashboard} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("login") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isRegister) {
        await authService.register({ name, email, password });
        setSuccess("Аккаунт создан. Проверьте почту и подтвердите регистрацию, затем войдите.");
        navigate(ROUTES.login, { replace: true });
        return;
      }

      const next = await authService.login({ email, password });
      if (next) {
        setUser(next);
        navigate(ROUTES.dashboard);
      } else {
        setError("Проверьте email и пароль. Если аккаунт только что создан, подтвердите его по ссылке из письма.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page compact>
      <Link className="back-link" to={ROUTES.home}><ArrowLeft size={17} />К началу</Link>
      <section className="auth-card card">
        <span className="eyebrow">Ваш следующий шаг</span>
        <h1>{isRegister ? "Создать аккаунт" : "Войти в обучение"}</h1>
        <p>
          {isRegister
            ? "Создайте аккаунт через Supabase. После регистрации подтвердите email и войдите в систему."
            : "Вход выполняется через Supabase по email и паролю."}
        </p>
        <form onSubmit={submit} className="form-stack" aria-label={isRegister ? "Регистрация" : "Вход"}>
          {isRegister && (
            <label>
              Имя
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            Email
            <input name="login" type="email" autoComplete={isRegister ? "email" : "username"} required maxLength={120} />
          </label>
          <label>
            Пароль
            <input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={8} maxLength={128} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="form-success" role="status">{success}</p>}
          <Button loading={loading} type="submit" fullWidth>
            {isRegister ? "Создать аккаунт" : "Войти"}
          </Button>
        </form>
        <div className="auth-switch">
          <Link to={isRegister ? ROUTES.login : ROUTES.register} className="text-link">
            {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
          </Link>
        </div>
        <button className="text-link guest-link" onClick={() => { setUser(authService.guest()); navigate(ROUTES.preview); }}>Предпросмотр</button>
      </section>
    </Page>
  );
}
