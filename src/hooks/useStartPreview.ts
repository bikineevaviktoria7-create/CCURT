import { useNavigate } from "react-router-dom";
import { useApp } from "../context/appState";
import { authService } from "../services/authService";
import { ROUTES } from "../app/constants";

/** Возвращает действие, которое входит гостем и открывает пробное упражнение. */
export function useStartPreview() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  return () => {
    setUser(authService.guest());
    navigate(ROUTES.preview);
  };
}
