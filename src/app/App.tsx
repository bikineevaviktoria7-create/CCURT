import { feedback } from "../lib/feedback";
import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { APP_NAME } from "./constants";
import { router } from "./router";
import { AppProvider } from "../context/AppProvider";

export function App() {
  useEffect(() => {
    document.title = `${APP_NAME} – русский жестовый язык`;
  }, []);

  useEffect(() => {
    const unlock = (event: Event) => { if (event.isTrusted) feedback.unlock(); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.25 }}>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
