/**
 * Logger
 * Request/response logging middleware
 */

import {
  LogLevel,
  LoggerFunction,
  RequestContext,
  ResponseContext,
  ErrorContext,
  RequestMiddleware,
  ResponseMiddleware,
  ErrorMiddleware,
} from './types.js';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Enable logging */
  enabled: boolean;
  /** Minimum log level */
  minLevel: LogLevel;
  /** Include request body in logs */
  logRequestBody: boolean;
  /** Include response body in logs */
  logResponseBody: boolean;
  /** Include headers in logs */
  logHeaders: boolean;
  /** Redact sensitive headers */
  redactHeaders: string[];
  /** Max body length to log */
  maxBodyLength: number;
  /** Custom formatter */
  formatter?: (entry: LogEntry) => string;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  message: string;
  requestId?: string;
  method?: string;
  url?: string;
  status?: number;
  duration?: number;
  error?: Error;
  metadata?: Record<string, unknown>;
}

const DEFAULT_LOGGER_OPTIONS: LoggerOptions = {
  enabled: true,
  minLevel: 'info',
  logRequestBody: false,
  logResponseBody: false,
  logHeaders: false,
  redactHeaders: ['authorization', 'x-api-key', 'cookie', 'set-cookie'],
  maxBodyLength: 1000,
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger class for request/response logging
 */
export class Logger {
  private options: LoggerOptions;
  private logFn: LoggerFunction;

  constructor(
    logFn?: LoggerFunction,
    options: Partial<LoggerOptions> = {}
  ) {
    this.options = { ...DEFAULT_LOGGER_OPTIONS, ...options };
    this.logFn = logFn || this.defaultLogger.bind(this);
  }

  /**
   * Default console logger
   */
  private defaultLogger(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.options.enabled) return;
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.minLevel]) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data && Object.keys(data).length > 0) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `${prefix} ${message}`,
        data
      );
    } else {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `${prefix} ${message}`
      );
    }
  }

  /**
   * Log a message
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.logFn(level, message, data);
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  /**
   * Redact sensitive headers
   */
  private redactHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (this.options.redactHeaders.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Truncate body for logging
   */
  private truncateBody(body: unknown): unknown {
    if (typeof body === 'string' && body.length > this.options.maxBodyLength) {
      return body.substring(0, this.options.maxBodyLength) + '... [truncated]';
    }
    if (typeof body === 'object' && body !== null) {
      const str = JSON.stringify(body);
      if (str.length > this.options.maxBodyLength) {
        return JSON.parse(str.substring(0, this.options.maxBodyLength) + '"}');
      }
    }
    return body;
  }

  /**
   * Log request
   */
  logRequest(context: RequestContext): void {
    const data: Record<string, unknown> = {
      requestId: context.requestId,
      method: context.method,
      url: context.url,
    };

    if (this.options.logHeaders) {
      data.headers = this.redactHeaders(context.headers);
    }

    if (this.options.logRequestBody && context.body !== undefined) {
      data.body = this.truncateBody(context.body);
    }

    this.info(`Request: ${context.method} ${context.url}`, data);
  }

  /**
   * Log response
   */
  logResponse(context: ResponseContext, request: RequestContext): void {
    const data: Record<string, unknown> = {
      requestId: context.requestId,
      status: context.status,
      duration: context.duration,
      method: request.method,
      url: request.url,
    };

    if (this.options.logHeaders) {
      data.headers = this.redactHeaders(context.headers);
    }

    if (this.options.logResponseBody && context.body !== undefined) {
      data.body = this.truncateBody(context.body);
    }

    const level: LogLevel = context.status >= 400 ? 'warn' : 'info';
    this.log(level, `Response: ${context.status} (${context.duration}ms)`, data);
  }

  /**
   * Log error
   */
  logError(context: ErrorContext): void {
    const data: Record<string, unknown> = {
      requestId: context.requestId,
      error: context.error.message,
      code: context.code,
      retryable: context.retryable,
    };

    if (context.response?.status) {
      data.status = context.response.status;
    }

    if (context.request) {
      data.method = context.request.method;
      data.url = context.request.url;
    }

    this.error(`Error: ${context.error.message}`, data);
  }

  /**
   * Create request logging middleware
   */
  createRequestMiddleware(): RequestMiddleware {
    return async (context) => {
      this.logRequest(context);
      return { continue: true, context };
    };
  }

  /**
   * Create response logging middleware
   */
  createResponseMiddleware(): ResponseMiddleware {
    return async (context, request) => {
      this.logResponse(context, request);
      return { continue: true, context };
    };
  }

  /**
   * Create error logging middleware
   */
  createErrorMiddleware(): ErrorMiddleware {
    return async (context) => {
      this.logError(context);
      return { continue: true, context };
    };
  }
}

/**
 * Create a silent logger that does nothing
 */
export function createSilentLogger(): Logger {
  return new Logger(() => {}, { enabled: false });
}

/**
 * Create a logger that writes to a file
 */
export function createFileLogger(
  writeToFile: (entry: string) => void,
  options: Partial<LoggerOptions> = {}
): Logger {
  const logFn: LoggerFunction = (level, message, data) => {
    const entry = JSON.stringify({
      level,
      timestamp: new Date().toISOString(),
      message,
      ...data,
    });
    writeToFile(entry + '\n');
  };

  return new Logger(logFn, options);
}

/**
 * Create a buffered logger that batches log entries
 */
export function createBufferedLogger(
  flushFn: (entries: LogEntry[]) => void,
  bufferSize: number = 100,
  flushIntervalMs: number = 5000,
  options: Partial<LoggerOptions> = {}
): Logger {
  const buffer: LogEntry[] = [];
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = () => {
    if (buffer.length > 0) {
      const entries = buffer.splice(0, buffer.length);
      flushFn(entries);
    }
  };

  const startTimer = () => {
    if (!flushTimer) {
      flushTimer = setInterval(flush, flushIntervalMs);
    }
  };

  const logFn: LoggerFunction = (level, message, data) => {
    buffer.push({
      level,
      timestamp: new Date(),
      message,
      ...data,
    });

    if (buffer.length >= bufferSize) {
      flush();
    } else {
      startTimer();
    }
  };

  return new Logger(logFn, options);
}
