'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ErrorBoundaryFallback } from '@/components/ui/ErrorState';

interface MainContentProps {
  children: ReactNode;
}

/**
 * Wraps the main page content area with a granular error boundary.
 * If a page-level component throws, only the main content area shows
 * the error fallback UI -- the Header, Footer, and navigation remain
 * functional so the user can navigate away.
 */
export function MainContent({ children }: MainContentProps) {
  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <ErrorBoundaryFallback
          error={error}
          resetErrorBoundary={resetErrorBoundary}
        />
      )}
      onError={(error, errorInfo) => {
        console.error(
          '[MainContent ErrorBoundary] Page content error:',
          error,
          errorInfo
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
