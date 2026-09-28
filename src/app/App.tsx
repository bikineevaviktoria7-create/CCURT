import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { APP_NAME } from './constants';
import { router } from './router';

export function App() {
  useEffect(() => {
    document.title = `${APP_NAME} — русский жестовый язык`;
  }, []);

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.25 }}>
        <RouterProvider router={router} />
      </MotionConfig>
    </ErrorBoundary>
  );
}
