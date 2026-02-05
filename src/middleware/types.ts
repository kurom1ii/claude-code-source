/**
 * Middleware Types
 * Defines core interfaces for the middleware chain
 */

export interface RequestContext {
  /** Unique request identifier */
  requestId: string;
  /** HTTP method */
  method: string;
  /** Request URL/endpoint */
  url: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Request timestamp */
  timestamp: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

export interface ResponseContext {
  /** Associated request ID */
  requestId: string;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body?: unknown;
  /** Response timestamp */
  timestamp: Date;
  /** Duration in milliseconds */
  duration: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

export interface ErrorContext {
  /** Associated request ID */
  requestId: string;
  /** Error object */
  error: Error;
  /** Error code */
  code?: string;
  /** Error timestamp */
  timestamp: Date;
  /** Original request context */
  request?: RequestContext;
  /** Partial response if available */
  response?: Partial<ResponseContext>;
  /** Whether error is retryable */
  retryable: boolean;
}

export interface MiddlewareResult<T> {
  /** Whether to continue middleware chain */
  continue: boolean;
  /** Modified context */
  context: T;
  /** Error if any */
  error?: Error;
}

export type RequestMiddleware = (
  context: RequestContext
) => Promise<MiddlewareResult<RequestContext>>;

export type ResponseMiddleware = (
  context: ResponseContext,
  request: RequestContext
) => Promise<MiddlewareResult<ResponseContext>>;

export type ErrorMiddleware = (
  context: ErrorContext
) => Promise<MiddlewareResult<ErrorContext>>;

export interface MiddlewareChain {
  /** Request interceptors - run before request */
  request: RequestMiddleware[];
  /** Response transformers - run after response */
  response: ResponseMiddleware[];
  /** Error handlers - run on errors */
  error: ErrorMiddleware[];
}

export interface MiddlewareOptions {
  /** Enable request logging */
  logRequests?: boolean;
  /** Enable response logging */
  logResponses?: boolean;
  /** Enable error logging */
  logErrors?: boolean;
  /** Custom logger function */
  logger?: LoggerFunction;
  /** Request timeout in ms */
  timeout?: number;
  /** Max retry attempts */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LoggerFunction = (
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
) => void;

export interface RetryConfig {
  /** Max retry attempts */
  maxAttempts: number;
  /** Base delay in ms */
  baseDelay: number;
  /** Max delay in ms */
  maxDelay: number;
  /** Exponential backoff factor */
  backoffFactor: number;
  /** Status codes to retry on */
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 500,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export const DEFAULT_MIDDLEWARE_OPTIONS: MiddlewareOptions = {
  logRequests: true,
  logResponses: true,
  logErrors: true,
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
};
