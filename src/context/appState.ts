import { createContext, useContext } from "react";
import type { User } from "../types/auth";
import type { LearningProgress, LessonResult } from "../types/progress";

interface AppState {
  user: User | null;
  /** False, пока сохранённая сессия восстанавливается с сервера. */
  authReady: boolean;
  progress: LearningProgress;
  setUser(user: User): void;
  logout(): void;
  complete(result: LessonResult): void;
}
/** Пользователь и прогресс для всего приложения; предоставляется `AppProvider`. */
export const AppContext = createContext<AppState | null>(null);

/** Читает состояние приложения; вне `AppProvider` бросает ошибку. */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider is required");
  return context;
}
