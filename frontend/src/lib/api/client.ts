/**
 * API Client for BaseBook Backend
 * Handles HTTP requests to the backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

/** Default timeout for most API requests (10 seconds) */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Extended timeout for swap quote requests (30 seconds) */
export const SWAP_QUOTE_TIMEOUT_MS = 30_000;

export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

export interface RequestOptions {
  /** Request timeout in milliseconds. Defaults to DEFAULT_TIMEOUT_MS (10s). */
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Base API client
 */
class ApiClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Execute a fetch request with an AbortController timeout.
   * Throws a user-friendly ApiClientError when the request times out.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiClientError(
          `Request timed out after ${timeoutMs / 1000} seconds. Please try again.`,
          'REQUEST_TIMEOUT'
        );
      }
      // Re-throw AbortError from newer environments where it is its own class
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiClientError(
          `Request timed out after ${timeoutMs / 1000} seconds. Please try again.`,
          'REQUEST_TIMEOUT'
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make a GET request
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: RequestOptions
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await this.fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: this.headers,
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Make a POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}${endpoint}`,
      {
        method: 'POST',
        headers: this.headers,
        body: data ? JSON.stringify(data) : undefined,
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}${endpoint}`,
      {
        method: 'PUT',
        headers: this.headers,
        body: data ? JSON.stringify(data) : undefined,
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}${endpoint}`,
      {
        method: 'DELETE',
        headers: this.headers,
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Handle response and errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: ApiError;

      try {
        errorData = await response.json();
      } catch {
        errorData = {
          message: response.statusText || 'Unknown error',
          code: `HTTP_${response.status}`,
        };
      }

      throw new ApiClientError(
        errorData.message,
        errorData.code,
        errorData.details
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    try {
      return await response.json();
    } catch {
      throw new ApiClientError(
        'Failed to parse response',
        'PARSE_ERROR'
      );
    }
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update headers
   */
  setHeaders(headers: HeadersInit): void {
    this.headers = { ...this.headers, ...headers };
  }
}

/**
 * Singleton instance
 */
export const apiClient = new ApiClient();

/**
 * Health check
 */
export async function checkApiHealth(): Promise<{ status: string; timestamp: number }> {
  try {
    return await apiClient.get('/health');
  } catch (error) {
    throw new ApiClientError(
      'Backend API is not available',
      'API_UNAVAILABLE',
      error
    );
  }
}
