import { createBrowserRouter } from 'react-router-dom';
import { FoundationPage } from '../pages/FoundationPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ErrorFallback } from '../components/common/ErrorBoundary';
import { ROUTES } from './constants';

export const router = createBrowserRouter([
  { path: ROUTES.home, element: <FoundationPage />, errorElement: <ErrorFallback /> },
  { path: '*', element: <NotFoundPage />, errorElement: <ErrorFallback /> },
]);
