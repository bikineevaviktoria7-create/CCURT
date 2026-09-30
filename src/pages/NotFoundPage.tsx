import { ArrowLeft, RouteOff } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "../app/constants";

export function NotFoundPage() {
  return (
    <main className="message-page">
      <RouteOff size={44} className="text-primary" aria-hidden="true" />
      <span className="eyebrow">Ошибка 404</span>
      <h1>Кажется, мы сбились с пути</h1>
      <p>Такой страницы нет. Вернёмся к началу?</p>
      <Link to={ROUTES.home} className="button button--primary">
        <ArrowLeft size={18} aria-hidden="true" /> На главную
      </Link>
    </main>
  );
}
