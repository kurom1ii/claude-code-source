/**
 * Middleware Module
 * Central exports for middleware layer
 */

// Types
export * from './types.js';

// Core components
export {
  RequestInterceptor,
  createRequestContext,
  createHeadersMiddleware,
  createAuthMiddleware,
  createUserAgentMiddleware,
  createValidationMiddleware,
  createBodyTransformMiddleware as createRequestBodyTransformMiddleware,
  createMetadataMiddleware as createRequestMetadataMiddleware,
} from './RequestInterceptor.js';

export {
  ResponseTransformer,
  createResponseContext,
  createJsonParserMiddleware,
  createStatusValidatorMiddleware,
  createBodyTransformMiddleware as createResponseBodyTransformMiddleware,
  createFieldExtractorMiddleware,
  createMetadataMiddleware as createResponseMetadataMiddleware,
  createCacheMiddleware,
  createUnwrapMiddleware,
} from './ResponseTransformer.js';

export {
  ErrorHandler,
  ErrorCategory,
  createErrorContext,
  categorizeError,
  createRetryMarkerMiddleware,
  createCategorizerMiddleware,
  createCodeHandlerMiddleware,
  createStatusHandlerMiddleware,
  createErrorWrapperMiddleware,
  createErrorSuppressorMiddleware,
} from './ErrorHandler.js';

export {
  Logger,
  createSilentLogger,
  createFileLogger,
  createBufferedLogger,
  type LoggerOptions,
  type LogEntry,
} from './Logger.js';

// Convenience imports
import { RequestInterceptor } from './RequestInterceptor.js';
import { ResponseTransformer } from './ResponseTransformer.js';
import { ErrorHandler } from './ErrorHandler.js';
import { Logger } from './Logger.js';
import {
  MiddlewareChain,
  MiddlewareOptions,
  RequestContext,
  ResponseContext,
  ErrorContext,
  DEFAULT_MIDDLEWARE_OPTIONS,
} from './types.js';

/**
 * Middleware Manager
 * Unified interface for managing all middleware chains
 */
export class MiddlewareManager {
  readonly request: RequestInterceptor;
  readonly response: ResponseTransformer;
  readonly error: ErrorHandler;
  readonly logger: Logger;

  constructor(options: Partial<MiddlewareOptions> = {}) {
    const opts = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };

    this.logger = new Logger(opts.logger);
    this.request = new RequestInterceptor(opts);
    this.response = new ResponseTransformer(opts);
    this.error = new ErrorHandler(opts);

    // Add logging middleware if enabled
    if (opts.logRequests) {
      this.request.use(this.logger.createRequestMiddleware());
    }
    if (opts.logResponses) {
      this.response.use(this.logger.createResponseMiddleware());
    }
    if (opts.logErrors) {
      this.error.use(this.logger.createErrorMiddleware());
    }
  }

  /**
   * Process a request through the middleware chain
   */
  async processRequest(context: RequestContext): Promise<RequestContext> {
    const result = await this.request.execute(context);
    if (result.error) {
      throw result.error;
    }
    return result.context;
  }

  /**
   * Process a response through the middleware chain
   */
  async processResponse(
    context: ResponseContext,
    request: RequestContext
  ): Promise<ResponseContext> {
    const result = await this.response.execute(context, request);
    if (result.error) {
      throw result.error;
    }
    return result.context;
  }

  /**
   * Process an error through the middleware chain
   */
  async processError(context: ErrorContext): Promise<ErrorContext> {
    const result = await this.error.execute(context);
    return result.context;
  }

  /**
   * Export middleware chain configuration
   */
  toChain(): MiddlewareChain {
    return {
      request: [],
      response: [],
      error: [],
    };
  }
}

/**
 * Create a pre-configured middleware manager for API requests
 */
export function createApiMiddleware(
  baseHeaders: Record<string, string> = {},
  options: Partial<MiddlewareOptions> = {}
): MiddlewareManager {
  const manager = new MiddlewareManager(options);

  // Add standard request middleware
  manager.request.use(async (context) => ({
    continue: true,
    context: {
      ...context,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...baseHeaders,
        ...context.headers,
      },
    },
  }));

  // Add JSON parsing for responses
  manager.response.use(async (context, _request) => {
    if (typeof context.body === 'string') {
      try {
        return {
          continue: true,
          context: {
            ...context,
            body: JSON.parse(context.body),
          },
        };
      } catch {
        // Not JSON, continue
      }
    }
    return { continue: true, context };
  });

  return manager;
}

/**
 * Create a middleware manager with retry support
 */
export function createRetryMiddleware(
  maxRetries: number = 3,
  options: Partial<MiddlewareOptions> = {}
): MiddlewareManager {
  const manager = new MiddlewareManager({
    ...options,
    maxRetries,
  });

  // Mark retryable errors
  manager.error.use(async (context) => {
    const status = context.response?.status;
    const retryable =
      status !== undefined && [408, 429, 500, 502, 503, 504].includes(status);

    return {
      continue: true,
      context: {
        ...context,
        retryable,
      },
    };
  });

  return manager;
}
