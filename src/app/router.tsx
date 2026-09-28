import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { AuthPage } from "../pages/AuthPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LessonOverviewPage } from "../pages/LessonOverviewPage";
import { ProtectedRoutes } from "../components/layout/ProtectedRoutes";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ErrorFallback } from "../components/common/ErrorBoundary";
import { ROUTES } from "./constants";

export const router = createBrowserRouter([
  {
    path: ROUTES.home,
    element: <LandingPage />,
    errorElement: <ErrorFallback />,
  },
  {
    path: ROUTES.login,
    element: <AuthPage key="login" mode="login" />,
    errorElement: <ErrorFallback />,
  },
  {
    path: ROUTES.register,
    element: <AuthPage key="register" mode="register" />,
    errorElement: <ErrorFallback />,
  },
  {
    path: ROUTES.verifyEmail,
    element: <VerifyEmailPage />,
    errorElement: <ErrorFallback />,
  },
  {
    element: <ProtectedRoutes />,
    errorElement: <ErrorFallback />,
    children: [
      { path: ROUTES.dashboard, element: <DashboardPage /> },
      { path: "/lessons/:lessonId", element: <LessonOverviewPage /> },
      {
        path: "/lessons/:lessonId/play",
        lazy: async () => ({
          Component: (await import("../pages/LessonPage")).LessonPage,
        }),
      },
      {
        path: "/results/:sessionId",
        lazy: async () => ({
          Component: (await import("../pages/ResultsPage")).ResultsPage,
        }),
      },
    ],
  },
  { path: "*", element: <NotFoundPage />, errorElement: <ErrorFallback /> },
]);
