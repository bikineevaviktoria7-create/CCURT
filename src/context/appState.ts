import { createContext, useContext } from "react";
import type { User } from "../types/auth";
import type { LearningProgress, LessonResult } from "../types/progress";

interface AppState {
  user: User | null;
  /** False while the saved session is being restored from the server. */
  authReady: boolean;
  progress: LearningProgress;
  setUser(user: User): void;
  logout(): void;
  complete(result: LessonResult): void;
}
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider is required");
  return context;
}
