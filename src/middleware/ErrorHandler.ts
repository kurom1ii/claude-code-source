/**
 * Error Handler
 * Error handling middleware
 */

import {
  ErrorContext,
  ErrorMiddleware,
  MiddlewareResult,
  MiddlewareOptions,
  RequestContext,
  ResponseContext,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_MIDDLEWARE_OPTIONS,
} from './types.js';

/**
 * Creates a new error context
 */
export function createErrorContext(
  requestId: string,
  error: Error,
  options: {
    code?: string;
    request?: RequestContext;
    response?: Partial<ResponseContext>;
    retryable?: boolean;
  } = {}
): ErrorContext {
  return {
    requestId,
    error,
    code: options.code,
    timestamp: new Date(),
    request: options.request,
    response: options.response,
    retryable: options.retryable ?? false,
  };
}

/**
 * Error categories
 */
export enum ErrorCategory {
  Network = 'NETWORK',
  Timeout = 'TIMEOUT',
  Auth = 'AUTH',
  RateLimit = 'RATE_LIMIT',
  Server = 'SERVER',
  Client = 'CLIENT',
  Unknown = 'UNKNOWN',
}

/**
 * Categorize an error based on status code or error type
 */
export function categorizeError(context: ErrorContext): ErrorCategory {
  const status = context.response?.status;

  if (!status) {
    if (context.error.message.includes('timeout')) {
      return ErrorCategory.Timeout;
    }
    if (
      context.error.message.includes('network') ||
      context.error.message.includes('ECONNREFUSED')
    ) {
      return ErrorCategory.Network;
    }
    return ErrorCategory.Unknown;
  }

  if (status === 401 || status === 403) {
    return ErrorCategory.Auth;
  }
  if (status === 429) {
    return ErrorCategory.RateLimit;
  }
  if (status >= 500) {
    return ErrorCategory.Server;
  }
  if (status >= 400) {
    return ErrorCategory.Client;
  }

  return ErrorCategory.Unknown;
}

/**
 * Error Handler class for managing error middleware chain
 */
export class ErrorHandler {
  private middlewares: ErrorMiddleware[] = [];
  private options: MiddlewareOptions;
  private retryConfig: RetryConfig;

  constructor(
    options: Partial<MiddlewareOptions> = {},
    retryConfig: Partial<RetryConfig> = {}
  ) {
    this.options = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Add middleware to the chain
   */
  use(middleware: ErrorMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Remove middleware from the chain
   */
  remove(middleware: ErrorMiddleware): boolean {
    const index = this.middlewares.indexOf(middleware);
    if (index > -1) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares = [];
  }

  /**
   * Execute the middleware chain
   */
  async execute(context: ErrorContext): Promise<MiddlewareResult<ErrorContext>> {
    let currentContext = { ...context };

    for (const middleware of this.middlewares) {
      try {
        const result = await middleware(currentContext);

        if (!result.continue) {
          return result;
        }

        currentContext = result.context;
      } catch (error) {
        // If error handler itself throws, wrap it
        return {
          continue: false,
          context: {
            ...currentContext,
            error: error instanceof Error ? error : new Error(String(error)),
          },
        };
      }
    }

    return {
      continue: true,
      context: currentContext,
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(context: ErrorContext): boolean {
    if (context.response?.status) {
      return this.retryConfig.retryableStatuses.includes(context.response.status);
    }

    const category = categorizeError(context);
    return [ErrorCategory.Network, ErrorCategory.Timeout, ErrorCategory.Server].includes(
      category
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  getRetryDelay(attempt: number): number {
    const delay =
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Get middleware count
   */
  get count(): number {
    return this.middlewares.length;
  }
}

// Built-in middleware factories

/**
 * Creates a middleware that marks retryable errors
 */
export function createRetryMarkerMiddleware(
  retryConfig: Partial<RetryConfig> = {}
): ErrorMiddleware {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  return async (context) => {
    const status = context.response?.status;
    const isRetryable = status ? config.retryableStatuses.includes(status) : false;

    return {
      continue: true,
      context: {
        ...context,
        retryable: isRetryable,
      },
    };
  };
}

/**
 * Creates a middleware that categorizes errors
 */
export function createCategorizerMiddleware(): ErrorMiddleware {
  return async (context) => {
    const category = categorizeError(context);

    return {
      continue: true,
      context: {
        ...context,
        metadata: {
          ...context.request?.metadata,
          errorCategory: category,
        },
      } as ErrorContext,
    };
  };
}

/**
 * Creates a middleware that handles specific error codes
 */
export function createCodeHandlerMiddleware(
  handlers: Record<string, (context: ErrorContext) => ErrorContext | null>
): ErrorMiddleware {
  return async (context) => {
    if (context.code && handlers[context.code]) {
      const result = handlers[context.code](context);
      if (result === null) {
        return { continue: false, context };
      }
      return { continue: true, context: result };
    }
    return { continue: true, context };
  };
}

/**
 * Creates a middleware that handles specific status codes
 */
export function createStatusHandlerMiddleware(
  handlers: Record<number, (context: ErrorContext) => ErrorContext | null>
): ErrorMiddleware {
  return async (context) => {
    const status = context.response?.status;
    if (status && handlers[status]) {
      const result = handlers[status](context);
      if (result === null) {
        return { continue: false, context };
      }
      return { continue: true, context: result };
    }
    return { continue: true, context };
  };
}

/**
 * Creates a middleware that wraps errors with additional context
 */
export function createErrorWrapperMiddleware(
  wrapper: (error: Error, context: ErrorContext) => Error
): ErrorMiddleware {
  return async (context) => {
    return {
      continue: true,
      context: {
        ...context,
        error: wrapper(context.error, context),
      },
    };
  };
}

/**
 * Creates a middleware that suppresses specific errors
 */
export function createErrorSuppressorMiddleware(
  shouldSuppress: (context: ErrorContext) => boolean
): ErrorMiddleware {
  return async (context) => {
    if (shouldSuppress(context)) {
      return { continue: false, context };
    }
    return { continue: true, context };
  };
}
