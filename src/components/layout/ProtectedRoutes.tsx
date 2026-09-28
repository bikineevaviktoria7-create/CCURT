import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../../context/appState";
import { ROUTES } from "../../app/constants";

export function ProtectedRoutes() {
  const { user } = useApp();
  return user ? <Outlet /> : <Navigate to={ROUTES.home} replace />;
}
