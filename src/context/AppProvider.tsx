import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authService } from "../services/authService";
import { emptyProgress, isDemoResult, progressService } from "../services/progressService";
import { syncService } from "../services/syncService";
import { useLatestRef } from "../hooks/useLatestRef";
import { AppContext } from "./appState";
import type { User } from "../types/auth";
import type { LessonResult } from "../types/progress";

/** Holds the signed-in user and their progress; restores the session on start. */
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState(authService.getCurrentUser);
  const [authReady, setAuthReady] = useState(!authService.isRemote);
  const [progress, updateProgress] = useState(() =>
    user ? progressService.getProgress(user.id) : emptyProgress(),
  );
  const current = useLatestRef(user);

  const pull = useCallback((account: User) => {
    if (account.isGuest || account.authProvider === "mock" || !syncService.enabled) return;
    syncService.pull(account.id).then(
      (merged) => {
        if (current.current?.id === account.id) updateProgress(merged);
      },
      (error: unknown) => console.warn("[SignStep] прогресс не синхронизирован", error),
    );
  }, [current]);

  useEffect(() => {
    let active = true;
    authService.initialize().then(
      (restored) => {
        if (!active) return;
        updateUser(restored);
        updateProgress(restored ? progressService.getProgress(restored.id) : emptyProgress());
        setAuthReady(true);
        if (restored) pull(restored);
      },
      () => active && setAuthReady(true),
    );
    const unsubscribe = authService.onSignedOut(() => {
      if (current.current && !current.current.isGuest) {
        updateUser(null);
        updateProgress(emptyProgress());
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pull, current]);

  const setUser = useCallback(
    (next: User) => {
      updateUser(next);
      updateProgress(progressService.getProgress(next.id));
      pull(next);
    },
    [pull],
  );
  const logout = useCallback(() => {
    authService.logout();
    updateUser(null);
    updateProgress(emptyProgress());
  }, []);
  const complete = useCallback(
    (result: LessonResult) => {
      if (!user || user.isGuest) return;
      updateProgress(progressService.completeLesson(user.id, result));
      if (user.authProvider !== "mock" && !isDemoResult(result)) syncService.push(user.id, result);
    },
    [user],
  );
  return (
    <AppContext.Provider value={{ user, authReady, progress, setUser, logout, complete }}>
      {children}
    </AppContext.Provider>
  );
}
