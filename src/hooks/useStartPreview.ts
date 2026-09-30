import { useNavigate } from "react-router-dom";
import { useApp } from "../context/appState";
import { authService } from "../services/authService";
import { ROUTES } from "../app/constants";

/** Returns an action that signs in as a guest and opens the preview exercise. */
export function useStartPreview() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  return () => {
    setUser(authService.guest());
    navigate(ROUTES.preview);
  };
}
