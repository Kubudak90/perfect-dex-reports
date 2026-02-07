'use client';

import { cn } from '@/lib/utils/cn';
import { Button } from './Button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while loading this content. Please try again.',
  onRetry,
  showHomeButton = false,
  className,
}: ErrorStateProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>

      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md">{message}</p>

      <div className="flex items-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
        {showHomeButton && (
          <Button
            variant="secondary"
            onClick={() => router.push('/')}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <ErrorState
        title="Oops! Something went wrong"
        message={
          process.env.NODE_ENV === 'development'
            ? error.message
            : 'An unexpected error occurred. Please try refreshing the page.'
        }
        onRetry={resetErrorBoundary}
        showHomeButton
      />
    </div>
  );
}

export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Network Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      onRetry={onRetry}
    />
  );
}

export function NotFoundState() {
  const router = useRouter();

  return (
    <ErrorState
      title="404 - Not Found"
      message="The page or resource you're looking for doesn't exist."
      onRetry={() => router.back()}
      showHomeButton
    />
  );
}
