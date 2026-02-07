import axios, { type AxiosInstance } from 'axios';
import type { Address } from 'viem';

/**
 * Rust Router API Types
 */
export interface RouterQuoteRequest {
  token_in: Address;
  token_out: Address;
  amount_in: string;
  slippage?: number;
  max_hops?: number;
  max_splits?: number;
}

export interface RouterPoolInfo {
  pool_id: number[];
  token0: Address;
  token1: Address;
  fee: number;
  tick_spacing: number;
  liquidity: number;
  sqrt_price_x96: string;
  tick: number;
  hook_address: Address;
}

export interface RouterHop {
  pool: RouterPoolInfo;
  token_in: Address;
  token_out: Address;
  amount_in: string;
  amount_out: string;
}

export interface RouterRoute {
  hops: RouterHop[];
  total_amount_in: string;
  total_amount_out: string;
  price_impact: number;
  gas_estimate: number;
}

export interface RouterSplitRoute {
  total_amount_in: string;
  total_amount_out: string;
  total_gas_estimate: number;
  combined_price_impact: number;
  routes: Array<[RouterRoute, number]>; // [route, percentage]
}

export interface RouterQuote {
  amount_in: string;
  amount_out: string;
  amount_out_min: string;
  price_impact: number;
  gas_estimate: number;
  gas_estimate_usd: number;
  route_string: string;
  route: RouterSplitRoute;
}

export interface RouterQuoteResponse {
  quote: RouterQuote;
  timestamp: number;
  cached: boolean;
}

export interface RouterHealthResponse {
  status: string;
  version: string;
  chain_id: number;
  graph_stats: {
    token_count: number;
    pool_count: number;
    last_update: number;
  };
}

export interface RouterErrorResponse {
  error: string;
  message: string;
}

/**
 * Service for calling Rust Router HTTP API
 */
export class RouterService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.ROUTER_API_URL || 'http://localhost:3001';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // 10s timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          if (error.response) {
            // Server responded with error
            const errorData = error.response.data as RouterErrorResponse;
            throw new RouterError(
              errorData.message || error.message,
              error.response.status,
              errorData
            );
          } else if (error.request) {
            // No response received
            throw new RouterError(
              'Router service unavailable',
              503,
              { error: 'ServiceUnavailable', message: 'No response from router' }
            );
          }
        }
        throw error;
      }
    );
  }

  /**
   * Health check
   */
  async health(): Promise<RouterHealthResponse> {
    const response = await this.client.get<RouterHealthResponse>('/health');
    return response.data;
  }

  /**
   * Get swap quote from router
   */
  async getQuote(request: RouterQuoteRequest): Promise<RouterQuoteResponse> {
    const params = {
      token_in: request.token_in,
      token_out: request.token_out,
      amount_in: request.amount_in,
      slippage: request.slippage ?? 0.5,
      max_hops: request.max_hops,
      max_splits: request.max_splits,
    };

    const response = await this.client.get<RouterQuoteResponse>('/v1/quote', { params });
    return response.data;
  }

  /**
   * Get quote with retry logic
   */
  async getQuoteWithRetry(
    request: RouterQuoteRequest,
    maxRetries = 3
  ): Promise<RouterQuoteResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getQuote(request);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (client errors)
        if (error instanceof RouterError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Failed to get quote after retries');
  }

  /**
   * Check if router is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Get router stats
   */
  async getStats(): Promise<RouterHealthResponse['graph_stats']> {
    const health = await this.health();
    return health.graph_stats;
  }
}

/**
 * Custom error class for router errors
 */
export class RouterError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: RouterErrorResponse
  ) {
    super(message);
    this.name = 'RouterError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      data: this.data,
    };
  }
}

// Export singleton instance
export const routerService = new RouterService();
