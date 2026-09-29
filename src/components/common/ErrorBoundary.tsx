import { Component } from 'react';
import type { ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from './Button';

export function ErrorFallback() {
  return (
    <main className="message-page">
      <TriangleAlert size={40} className="text-warning" aria-hidden="true" />
      <h1>Что-то пошло не так</h1>
      <p>Попробуйте перезагрузить страницу</p>
      <Button icon={<RefreshCw size={18} aria-hidden="true" />} onClick={() => window.location.reload()}>
        Перезагрузить
      </Button>
    </main>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}
