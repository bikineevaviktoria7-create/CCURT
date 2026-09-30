import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { AuthPage } from "../pages/AuthPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LessonOverviewPage } from "../pages/LessonOverviewPage";
import { ProtectedRoutes, PreviewRoutes } from "../components/layout/ProtectedRoutes";
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
    element: <AuthPage />,
    errorElement: <ErrorFallback />,
  },
  {
    element: <ProtectedRoutes />,
    errorElement: <ErrorFallback />,
    children: [
      { path: ROUTES.dashboard, element: <DashboardPage /> },
      { path: ROUTES.lessonPattern, element: <LessonOverviewPage /> },
      {
        path: ROUTES.playPattern,
        lazy: async () => ({
          Component: (await import("../pages/LessonPage")).LessonPage,
        }),
      },
      {
        path: ROUTES.resultsPattern,
        lazy: async () => ({
          Component: (await import("../pages/ResultsPage")).ResultsPage,
        }),
      },
    ],
  },
  {
    element: <PreviewRoutes />,
    children: [
      { path: ROUTES.preview, lazy: async () => ({ Component: (await import("../pages/PreviewPage")).PreviewPage }) },
      { path: ROUTES.previewResult, lazy: async () => ({ Component: (await import("../pages/PreviewPage")).PreviewResultPage }) },
    ],
  },
  { path: "*", element: <NotFoundPage />, errorElement: <ErrorFallback /> },
]);
