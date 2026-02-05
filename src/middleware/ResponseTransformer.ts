/**
 * Response Transformer
 * Post-response processing middleware
 */

import {
  ResponseContext,
  RequestContext,
  ResponseMiddleware,
  MiddlewareResult,
  MiddlewareOptions,
  DEFAULT_MIDDLEWARE_OPTIONS,
} from './types.js';

/**
 * Creates a new response context
 */
export function createResponseContext(
  requestId: string,
  status: number,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
    duration?: number;
    metadata?: Record<string, unknown>;
  } = {}
): ResponseContext {
  return {
    requestId,
    status,
    headers: options.headers || {},
    body: options.body,
    timestamp: new Date(),
    duration: options.duration || 0,
    metadata: options.metadata || {},
  };
}

/**
 * Response Transformer class for managing response middleware chain
 */
export class ResponseTransformer {
  private middlewares: ResponseMiddleware[] = [];
  private options: MiddlewareOptions;

  constructor(options: Partial<MiddlewareOptions> = {}) {
    this.options = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
  }

  /**
   * Add middleware to the chain
   */
  use(middleware: ResponseMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Remove middleware from the chain
   */
  remove(middleware: ResponseMiddleware): boolean {
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
  async execute(
    context: ResponseContext,
    request: RequestContext
  ): Promise<MiddlewareResult<ResponseContext>> {
    let currentContext = { ...context };

    for (const middleware of this.middlewares) {
      try {
        const result = await middleware(currentContext, request);

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
 * Creates a middleware that parses JSON response body
 */
export function createJsonParserMiddleware(): ResponseMiddleware {
  return async (context, _request) => {
    if (typeof context.body === 'string') {
      try {
        const parsed = JSON.parse(context.body);
        return {
          continue: true,
          context: {
            ...context,
            body: parsed,
          },
        };
      } catch {
        // Not valid JSON, continue with original body
        return { continue: true, context };
      }
    }
    return { continue: true, context };
  };
}

/**
 * Creates a middleware that validates response status
 */
export function createStatusValidatorMiddleware(
  validStatuses: number[] = [200, 201, 204]
): ResponseMiddleware {
  return async (context, _request) => {
    if (validStatuses.includes(context.status)) {
      return { continue: true, context };
    }

    return {
      continue: false,
      context,
      error: new Error(`Invalid status code: ${context.status}`),
    };
  };
}

/**
 * Creates a middleware that transforms response body
 */
export function createBodyTransformMiddleware(
  transformer: (body: unknown, context: ResponseContext) => unknown
): ResponseMiddleware {
  return async (context, _request) => {
    if (context.body === undefined) {
      return { continue: true, context };
    }

    return {
      continue: true,
      context: {
        ...context,
        body: transformer(context.body, context),
      },
    };
  };
}

/**
 * Creates a middleware that extracts specific fields from response
 */
export function createFieldExtractorMiddleware(
  fields: string[]
): ResponseMiddleware {
  return async (context, _request) => {
    if (typeof context.body !== 'object' || context.body === null) {
      return { continue: true, context };
    }

    const body = context.body as Record<string, unknown>;
    const extracted: Record<string, unknown> = {};

    for (const field of fields) {
      if (field in body) {
        extracted[field] = body[field];
      }
    }

    return {
      continue: true,
      context: {
        ...context,
        body: extracted,
      },
    };
  };
}

/**
 * Creates a middleware that adds response metadata
 */
export function createMetadataMiddleware(
  metadata: Record<string, unknown> | ((context: ResponseContext) => Record<string, unknown>)
): ResponseMiddleware {
  return async (context, _request) => {
    const additionalMetadata = typeof metadata === 'function' ? metadata(context) : metadata;

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

/**
 * Creates a middleware that caches responses
 */
export function createCacheMiddleware(
  cache: Map<string, { response: ResponseContext; expires: number }>,
  ttlMs: number = 60000
): ResponseMiddleware {
  return async (context, request) => {
    const cacheKey = `${request.method}:${request.url}`;

    cache.set(cacheKey, {
      response: context,
      expires: Date.now() + ttlMs,
    });

    return { continue: true, context };
  };
}

/**
 * Creates a middleware that unwraps nested response data
 */
export function createUnwrapMiddleware(
  dataKey: string = 'data'
): ResponseMiddleware {
  return async (context, _request) => {
    if (
      typeof context.body === 'object' &&
      context.body !== null &&
      dataKey in (context.body as Record<string, unknown>)
    ) {
      return {
        continue: true,
        context: {
          ...context,
          body: (context.body as Record<string, unknown>)[dataKey],
        },
      };
    }
    return { continue: true, context };
  };
}
