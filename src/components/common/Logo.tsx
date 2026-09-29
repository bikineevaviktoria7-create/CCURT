import { Link } from "react-router-dom";
import { APP_NAME, ROUTES } from "../../app/constants";

export function Logo({ to = ROUTES.home }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label={`${APP_NAME} – на главную`}>
      <img className="logo-symbol" src="/assets/branding/mark.svg" width="40" height="40" alt="" />
      <span>{APP_NAME}</span>
    </Link>
  );
}
