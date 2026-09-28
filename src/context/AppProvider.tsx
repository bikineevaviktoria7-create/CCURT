import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import type { LessonResult } from "../types/progress";
import { authService } from "../services/authService";
import { emptyProgress, progressService } from "../services/progressService";
import { AppContext } from "./appState";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState(authService.getUser);
  const [progress, updateProgress] = useState(() =>
    user ? progressService.getProgress(user.id) : emptyProgress(),
  );
  const setUser = useCallback((next: User) => {
    updateUser(next);
    updateProgress(progressService.getProgress(next.id));
  }, []);
  const logout = useCallback(() => {
    authService.logout();
    updateUser(null);
    updateProgress(emptyProgress());
  }, []);
  const complete = useCallback(
    (result: LessonResult) => {
      if (user) updateProgress(progressService.completeLesson(user.id, result));
    },
    [user],
  );
  return (
    <AppContext.Provider value={{ user, progress, setUser, logout, complete }}>
      {children}
    </AppContext.Provider>
  );
}
