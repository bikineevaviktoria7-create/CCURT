import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Logo } from "../common/Logo";
import { useApp } from "../../context/appState";
import { ROUTES } from "../../app/constants";
import { storage } from "../../lib/storage";

export function Page({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <>
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <header className="site-header page-container">
        <Logo to={user && !user.isGuest ? ROUTES.dashboard : ROUTES.home} />
        <span className="header-description">Русский жестовый язык</span>
        <nav aria-label="Основная навигация" className="header-actions">
          {user ? (
            <>
              <span className="user-name">
                {user.isGuest ? "Гостевой режим" : user.name}
              </span>
              <button
                className="icon-button"
                aria-label="Выйти"
                onClick={() => {
                  logout();
                  navigate(ROUTES.home);
                }}
              >
                <LogOut size={19} />
              </button>
            </>
          ) : (
            <Link className="text-link" to={ROUTES.login}>
              Войти
            </Link>
          )}
        </nav>
      </header>
      <motion.main
        ref={main}
        id="main"
        tabIndex={-1}
        className={`page-container page-main ${compact ? "page-main--compact" : ""}`}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {!storage.isPersistent() && (
          <p className="notice" role="status">
            Браузер не разрешает сохранять данные. Прогресс доступен до закрытия
            страницы.
          </p>
        )}
        {children}
      </motion.main>
    </>
  );
}
