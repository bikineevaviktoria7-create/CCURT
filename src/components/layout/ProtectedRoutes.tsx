import { Navigate, Outlet } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useApp } from "../../context/appState";
import { ROUTES } from "../../app/constants";
import { canUsePlatform } from "../../services/accessService";

export function ProtectedRoutes() {
  const { user, authReady } = useApp();
  if (!authReady)
    return (
      <div className="content-state" role="status">
        <LoaderCircle className="animate-spin text-primary" aria-hidden="true" />
        <p>Проверяем вход…</p>
      </div>
    );
  return canUsePlatform(user) ? <Outlet /> : <Navigate to={ROUTES.login} replace />;
}

export function PreviewRoutes() {
  const { user } = useApp();
  return user?.isGuest ? <Outlet /> : <Navigate to={canUsePlatform(user) ? ROUTES.dashboard : ROUTES.home} replace />;
}
