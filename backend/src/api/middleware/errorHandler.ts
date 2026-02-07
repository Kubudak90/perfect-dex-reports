import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, isOperationalError } from '../errors/AppError.js';
import { ZodError } from 'zod';

/**
 * Error response structure
 */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  statusCode: number;
  details?: any;
  stack?: string;
  requestId?: string;
  timestamp: string;
}

/**
 * Centralized error handler
 */
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const requestId = request.id;

  // Log the error
  request.log.error({
    err: error,
    requestId,
    url: request.url,
    method: request.method,
    ip: request.ip,
  }, 'Request error');

  // Handle different error types
  let errorResponse: ErrorResponse;

  if (error instanceof AppError) {
    // Application-specific errors
    errorResponse = handleAppError(error, requestId, isDevelopment);
  } else if (error instanceof ZodError) {
    // Zod validation errors
    errorResponse = handleZodError(error, requestId, isDevelopment);
  } else if ('statusCode' in error && error.statusCode) {
    // Fastify errors with status code
    errorResponse = handleFastifyError(error as FastifyError, requestId, isDevelopment);
  } else {
    // Unknown errors
    errorResponse = handleUnknownError(error, requestId, isDevelopment);
  }

  // Send error response
  reply.code(errorResponse.statusCode).send(errorResponse);
}

/**
 * Handle AppError instances
 */
function handleAppError(
  error: AppError,
  requestId: string,
  isDevelopment: boolean
): ErrorResponse {
  return {
    success: false,
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
    ...(error.details && { details: error.details }),
    ...(isDevelopment && { stack: error.stack }),
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle Zod validation errors
 */
function handleZodError(
  error: ZodError,
  requestId: string,
  isDevelopment: boolean
): ErrorResponse {
  const details = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return {
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details,
    ...(isDevelopment && { stack: error.stack }),
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle Fastify-specific errors
 */
function handleFastifyError(
  error: FastifyError,
  requestId: string,
  isDevelopment: boolean
): ErrorResponse {
  // Map Fastify error codes to custom codes
  let code = 'INTERNAL_ERROR';
  let statusCode = error.statusCode || 500;

  if (error.code === 'FST_ERR_VALIDATION') {
    code = 'VALIDATION_ERROR';
    statusCode = 400;
  } else if (error.code === 'FST_ERR_NOT_FOUND') {
    code = 'NOT_FOUND';
    statusCode = 404;
  } else if (error.code === 'ECONNREFUSED') {
    code = 'SERVICE_UNAVAILABLE';
    statusCode = 503;
  } else if (error.code === 'ETIMEDOUT') {
    code = 'TIMEOUT';
    statusCode = 408;
  }

  return {
    success: false,
    error: error.message || 'Internal server error',
    code,
    statusCode,
    ...(error.validation && { details: error.validation }),
    ...(isDevelopment && { stack: error.stack }),
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle unknown errors
 */
function handleUnknownError(
  error: Error,
  requestId: string,
  isDevelopment: boolean
): ErrorResponse {
  // Check if it's an operational error
  const isOperational = isOperationalError(error);

  // Don't expose internal error details in production
  const message = isDevelopment || isOperational
    ? error.message
    : 'An unexpected error occurred';

  return {
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    ...(isDevelopment && { stack: error.stack }),
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Not found handler (404)
 */
export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const response: ErrorResponse = {
    success: false,
    error: `Route ${request.method} ${request.url} not found`,
    code: 'NOT_FOUND',
    statusCode: 404,
    requestId: request.id,
    timestamp: new Date().toISOString(),
  };

  reply.code(404).send(response);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T = any>(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<T>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      // Error will be caught by global error handler
      throw error;
    }
  };
}

/**
 * Process exit handler for uncaught errors
 */
export function setupProcessErrorHandlers(logger: any) {
  // Uncaught exception handler
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: error }, 'Uncaught exception');

    // Check if it's operational
    if (isOperationalError(error)) {
      logger.warn('Operational error, continuing...');
    } else {
      logger.fatal('Programming error detected, shutting down...');
      process.exit(1);
    }
  });

  // Unhandled promise rejection handler
  process.on('unhandledRejection', (reason: any) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');

    // Convert to error if needed
    const error = reason instanceof Error ? reason : new Error(String(reason));

    if (isOperationalError(error)) {
      logger.warn('Operational error, continuing...');
    } else {
      logger.fatal('Programming error detected, shutting down...');
      process.exit(1);
    }
  });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info({ signal }, 'Received shutdown signal');
      // Allow time for cleanup
      setTimeout(() => {
        logger.info('Shutting down gracefully');
        process.exit(0);
      }, 5000);
    });
  });
}

/**
 * Error monitoring and alerting
 */
export class ErrorMonitor {
  private errorCounts: Map<string, number> = new Map();
  private resetInterval: NodeJS.Timeout;

  constructor(
    private logger: any,
    private alertThreshold: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {
    // Reset counts every window
    this.resetInterval = setInterval(() => {
      this.errorCounts.clear();
    }, this.windowMs);
  }

  /**
   * Track error occurrence
   */
  track(error: Error | AppError): void {
    const errorKey = error instanceof AppError ? error.code : error.name;

    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);

    // Alert if threshold exceeded
    if (count === this.alertThreshold) {
      this.logger.error(
        {
          errorType: errorKey,
          count,
          threshold: this.alertThreshold,
          windowMs: this.windowMs,
        },
        'Error threshold exceeded - possible system issue'
      );

      // Here you could integrate with external alerting services
      // (PagerDuty, Sentry, Slack, etc.)
    }
  }

  /**
   * Get error statistics
   */
  getStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
    this.errorCounts.clear();
  }
}

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  /**
   * Execute function with circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeout) {
        // Try to recover
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();

      // Success - reset if in half-open state
      if (this.state === 'half-open') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a failure
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  /**
   * Reset circuit breaker
   */
  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  /**
   * Get current state
   */
  getState(): { state: string; failures: number } {
    return {
      state: this.state,
      failures: this.failures,
    };
  }
}
