import { Link } from 'react-router-dom';
import { APP_NAME, ROUTES } from '../../app/constants';

export function Logo() {
  return (
    <Link to={ROUTES.home} className="logo" aria-label={`${APP_NAME} — на главную`}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <rect width="36" height="36" rx="12" fill="currentColor" />
        <path d="M11 24v-6a3 3 0 0 1 3-3h3V9m0 18V15h5a3 3 0 0 1 3 3v6" className="logo-line" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{APP_NAME}</span>
    </Link>
  );
}
