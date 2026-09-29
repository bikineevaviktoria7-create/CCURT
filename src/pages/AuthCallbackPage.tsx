import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useApp } from "../context/appState";
import { authService } from "../services/authService";
import { ROUTES } from "../app/constants";

export function AuthCallbackPage() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    authService.init().then((restored) => {
      if (!active) return;
      if (restored) {
        setUser(restored);
        navigate(ROUTES.dashboard, { replace: true });
        return;
      }
      navigate(ROUTES.login, { replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate, setUser]);

  if (user && !user.isGuest) return <Navigate to={ROUTES.dashboard} replace />;

  return (
    <div className="content-state" role="status">
      <LoaderCircle className="animate-spin text-primary" aria-hidden="true" />
      <p>Подтверждаем email…</p>
    </div>
  );
}
