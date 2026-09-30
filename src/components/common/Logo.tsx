import logoUrl from "../../../logo.png";
import { Link } from "react-router-dom";
import { APP_NAME, ROUTES } from "../../app/constants";

export function Logo({ to = ROUTES.home }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label={`${APP_NAME} – на главную`}>
      <img className="logo-symbol" src={logoUrl} width="34" height="44" alt={`Логотип ${APP_NAME}`} />
      <span>{APP_NAME}</span>
    </Link>
  );
}
