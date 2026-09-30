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
/** App-wide user and progress; provided by `AppProvider`. */
export const AppContext = createContext<AppState | null>(null);

/** Reads the app state; throws outside `AppProvider`. */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider is required");
  return context;
}
