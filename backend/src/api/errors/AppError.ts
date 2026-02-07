/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: any) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(message, 401, 'UNAUTHORIZED', true, details);
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: any) {
    super(message, 403, 'FORBIDDEN', true, details);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: any) {
    super(`${resource} not found`, 404, 'NOT_FOUND', true, details);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: any) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends AppError {
  constructor(retryAfter: number, details?: any) {
    super(
      `Too many requests. Please retry after ${retryAfter} seconds.`,
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { retryAfter, ...details }
    );
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, 'INTERNAL_ERROR', true, details);
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: any) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE', true, details);
  }
}

/**
 * Blockchain RPC Error
 */
export class BlockchainRPCError extends AppError {
  constructor(message: string = 'Blockchain RPC error', details?: any) {
    super(message, 503, 'BLOCKCHAIN_RPC_ERROR', true, details);
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: any) {
    super(message, 500, 'DATABASE_ERROR', true, details);
  }
}

/**
 * Cache Error
 */
export class CacheError extends AppError {
  constructor(message: string = 'Cache error', details?: any) {
    super(message, 500, 'CACHE_ERROR', true, details);
  }
}

/**
 * External API Error
 */
export class ExternalAPIError extends AppError {
  constructor(service: string, message?: string, details?: any) {
    super(
      message || `External API error: ${service}`,
      503,
      'EXTERNAL_API_ERROR',
      true,
      { service, ...details }
    );
  }
}

/**
 * Insufficient Balance Error
 */
export class InsufficientBalanceError extends AppError {
  constructor(token: string, required: string, available: string) {
    super(
      `Insufficient ${token} balance`,
      400,
      'INSUFFICIENT_BALANCE',
      true,
      { token, required, available }
    );
  }
}

/**
 * Insufficient Liquidity Error
 */
export class InsufficientLiquidityError extends AppError {
  constructor(poolId?: string) {
    super(
      'Insufficient liquidity for this trade',
      400,
      'INSUFFICIENT_LIQUIDITY',
      true,
      poolId ? { poolId } : undefined
    );
  }
}

/**
 * Price Impact Too High Error
 */
export class PriceImpactTooHighError extends AppError {
  constructor(priceImpact: number, maxPriceImpact: number) {
    super(
      `Price impact too high: ${priceImpact}%`,
      400,
      'PRICE_IMPACT_TOO_HIGH',
      true,
      { priceImpact, maxPriceImpact }
    );
  }
}

/**
 * Slippage Exceeded Error
 */
export class SlippageExceededError extends AppError {
  constructor(expected: string, actual: string) {
    super(
      'Slippage tolerance exceeded',
      400,
      'SLIPPAGE_EXCEEDED',
      true,
      { expected, actual }
    );
  }
}

/**
 * Transaction Failed Error
 */
export class TransactionFailedError extends AppError {
  constructor(txHash?: string, reason?: string) {
    super(
      reason || 'Transaction failed',
      400,
      'TRANSACTION_FAILED',
      true,
      { txHash, reason }
    );
  }
}

/**
 * Invalid Address Error
 */
export class InvalidAddressError extends AppError {
  constructor(address: string) {
    super(
      `Invalid address: ${address}`,
      400,
      'INVALID_ADDRESS',
      true,
      { address }
    );
  }
}

/**
 * Invalid Pool Error
 */
export class InvalidPoolError extends AppError {
  constructor(poolId: string) {
    super(
      `Invalid pool: ${poolId}`,
      404,
      'INVALID_POOL',
      true,
      { poolId }
    );
  }
}

/**
 * Invalid Token Error
 */
export class InvalidTokenError extends AppError {
  constructor(token: string) {
    super(
      `Invalid token: ${token}`,
      404,
      'INVALID_TOKEN',
      true,
      { token }
    );
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends AppError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation timed out: ${operation}`,
      408,
      'TIMEOUT',
      true,
      { operation, timeoutMs }
    );
  }
}

/**
 * Error code to HTTP status mapping
 */
export const ERROR_CODES = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TIMEOUT: 408,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  CACHE_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  BLOCKCHAIN_RPC_ERROR: 503,
  EXTERNAL_API_ERROR: 503,

  // Business logic errors
  INSUFFICIENT_BALANCE: 400,
  INSUFFICIENT_LIQUIDITY: 400,
  PRICE_IMPACT_TOO_HIGH: 400,
  SLIPPAGE_EXCEEDED: 400,
  TRANSACTION_FAILED: 400,
  INVALID_ADDRESS: 400,
  INVALID_POOL: 404,
  INVALID_TOKEN: 404,
} as const;

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
