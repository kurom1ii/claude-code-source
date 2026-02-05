/**
 * Request Interceptor
 * Pre-request processing middleware
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RequestContext,
  RequestMiddleware,
  MiddlewareResult,
  MiddlewareOptions,
  DEFAULT_MIDDLEWARE_OPTIONS,
} from './types.js';

/**
 * Creates a new request context
 */
export function createRequestContext(
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
    metadata?: Record<string, unknown>;
  } = {}
): RequestContext {
  return {
    requestId: uuidv4(),
    method: method.toUpperCase(),
    url,
    headers: options.headers || {},
    body: options.body,
    timestamp: new Date(),
    metadata: options.metadata || {},
  };
}

/**
 * Request Interceptor class for managing request middleware chain
 */
export class RequestInterceptor {
  private middlewares: RequestMiddleware[] = [];
  private options: MiddlewareOptions;

  constructor(options: Partial<MiddlewareOptions> = {}) {
    this.options = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
  }

  /**
   * Add middleware to the chain
   */
  use(middleware: RequestMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Remove middleware from the chain
   */
  remove(middleware: RequestMiddleware): boolean {
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
  async execute(context: RequestContext): Promise<MiddlewareResult<RequestContext>> {
    let currentContext = { ...context };

    for (const middleware of this.middlewares) {
      try {
        const result = await middleware(currentContext);

        if (!result.continue) {
          return result;
        }

        currentContext = result.context;
      } catch (error) {
        return {
          continue: false,
          context: currentContext,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }

    return {
      continue: true,
      context: currentContext,
    };
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
 * Creates a middleware that adds default headers
 */
export function createHeadersMiddleware(
  defaultHeaders: Record<string, string>
): RequestMiddleware {
  return async (context) => {
    return {
      continue: true,
      context: {
        ...context,
        headers: {
          ...defaultHeaders,
          ...context.headers,
        },
      },
    };
  };
}

/**
 * Creates a middleware that adds authentication
 */
export function createAuthMiddleware(
  getToken: () => Promise<string | null>
): RequestMiddleware {
  return async (context) => {
    const token = await getToken();

    if (!token) {
      return {
        continue: true,
        context,
      };
    }

    return {
      continue: true,
      context: {
        ...context,
        headers: {
          ...context.headers,
          Authorization: `Bearer ${token}`,
        },
      },
    };
  };
}

/**
 * Creates a middleware that adds User-Agent header
 */
export function createUserAgentMiddleware(userAgent: string): RequestMiddleware {
  return async (context) => {
    return {
      continue: true,
      context: {
        ...context,
        headers: {
          ...context.headers,
          'User-Agent': userAgent,
        },
      },
    };
  };
}

/**
 * Creates a middleware that validates requests
 */
export function createValidationMiddleware(
  validator: (context: RequestContext) => boolean | string
): RequestMiddleware {
  return async (context) => {
    const result = validator(context);

    if (result === true) {
      return { continue: true, context };
    }

    const errorMessage = typeof result === 'string' ? result : 'Request validation failed';
    return {
      continue: false,
      context,
      error: new Error(errorMessage),
    };
  };
}

/**
 * Creates a middleware that transforms request body
 */
export function createBodyTransformMiddleware(
  transformer: (body: unknown) => unknown
): RequestMiddleware {
  return async (context) => {
    if (context.body === undefined) {
      return { continue: true, context };
    }

    return {
      continue: true,
      context: {
        ...context,
        body: transformer(context.body),
      },
    };
  };
}

/**
 * Creates a middleware that adds metadata
 */
export function createMetadataMiddleware(
  metadata: Record<string, unknown> | (() => Record<string, unknown>)
): RequestMiddleware {
  return async (context) => {
    const additionalMetadata = typeof metadata === 'function' ? metadata() : metadata;

    return {
      continue: true,
      context: {
        ...context,
        metadata: {
          ...context.metadata,
          ...additionalMetadata,
        },
      },
    };
  };
}
