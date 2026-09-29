import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "./Button";
import { ROUTES } from "../../app/constants";

export function ContentState({
  status,
  retry,
}: {
  status: "loading" | "error" | "missing" | "locked";
  retry?: () => void;
}) {
  return (
    <div className="content-state">
      {status === "loading" ? (
        <>
          <LoaderCircle
            className="animate-spin text-primary"
            aria-hidden="true"
          />
          <p role="status">Подготавливаем уроки…</p>
        </>
      ) : (
        <>
          <h1>
            {status === "error"
              ? "Не удалось загрузить уроки"
              : status === "locked"
                ? "Этот урок ещё впереди"
                : "Урок не найден"}
          </h1>
          <p>
            {status === "locked"
              ? "Завершите предыдущий урок на дорожке, чтобы продолжить"
              : "Вернитесь на главную и выберите занятие"}
          </p>
          {retry && <Button onClick={retry}>Попробовать снова</Button>}
          <Link className="text-link" to={ROUTES.dashboard}>
            Вернуться на главную
          </Link>
        </>
      )}
    </div>
  );
}
