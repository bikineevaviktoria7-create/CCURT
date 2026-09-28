import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Page } from "../components/layout/Page";
import { Button } from "../components/common/Button";
import { authService, DEMO_CODE } from "../services/authService";
import { useApp } from "../context/appState";
import { ROUTES } from "../app/constants";

export function VerifyEmailPage() {
  const [digits, setDigits] = useState<string[]>(Array<string>(6).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const { setUser } = useApp();
  const navigate = useNavigate();
  const email = authService.pendingEmail();
  useEffect(() => {
    if (countdown === 0) return;
    const timer = window.setTimeout(
      () => setCountdown((value) => value - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [countdown]);
  if (!email) return <Navigate to={ROUTES.register} replace />;
  function fill(value: string, index: number) {
    const text = value.replace(/\D/g, "").slice(0, 6 - index);
    setDigits((previous) => {
      const next = [...previous];
      if (!text) next[index] = "";
      else
        [...text].forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      return next;
    });
    if (text) refs.current[Math.min(5, index + text.length)]?.focus();
  }
  return (
    <Page compact>
      <section className="auth-card card">
        <MailCheck size={32} className="text-primary" />
        <h1>Подтверждение email</h1>
        <p>Введите код подтверждения</p>
        <p className="email-label">{email}</p>
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setLoading(true);
            try {
              const user = await authService.verify(digits.join(""));
              setUser(user);
              navigate(ROUTES.dashboard);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Не удалось подтвердить код.",
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="otp" role="group" aria-label="Код подтверждения">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                aria-label={`Цифра ${index + 1}`}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                value={digit}
                required
                pattern="[0-9]"
                onChange={(event) => fill(event.target.value, index)}
                onPaste={(event) => {
                  event.preventDefault();
                  fill(event.clipboardData.getData("text"), index);
                }}
                onFocus={(event) => event.target.select()}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !digit && index > 0)
                    refs.current[index - 1]?.focus();
                }}
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit" fullWidth loading={loading}>
            Подтвердить
          </Button>
        </form>
        <Button
          variant="ghost"
          disabled={countdown > 0}
          onClick={() => {
            setCountdown(30);
            setError("");
          }}
        >
          {countdown
            ? `Повторить через ${countdown} с`
            : "Получить код ещё раз"}
        </Button>
        <p className="demo-note">
          Демонстрационный код: <strong>{DEMO_CODE}</strong>. Письмо не
          отправляется.
        </p>
        <Link className="text-link" to={ROUTES.register}>
          Изменить данные регистрации
        </Link>
      </section>
    </Page>
  );
}
