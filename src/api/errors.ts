/**
 * Claude Code API - Error Handling
 * Các class xử lý lỗi từ Anthropic API
 */

import type { ApiErrorType, ApiErrorResponse } from './types';

// ============================================================================
// Base API Error - Lớp lỗi cơ sở
// ============================================================================

/**
 * Base class cho tất cả API errors
 */
export class AnthropicApiError extends Error {
  /** Loại lỗi từ API */
  public readonly type: ApiErrorType;
  /** HTTP status code */
  public readonly status: number;
  /** Request ID để debug */
  public readonly requestId?: string;

  constructor(
    message: string,
    type: ApiErrorType,
    status: number,
    requestId?: string
  ) {
    super(message);
    this.name = 'AnthropicApiError';
    this.type = type;
    this.status = status;
    this.requestId = requestId;

    // Đảm bảo instanceof hoạt động đúng
    Object.setPrototypeOf(this, AnthropicApiError.prototype);
  }

  /**
   * Tạo error từ API response
   */
  static fromResponse(response: ApiErrorResponse, status: number, requestId?: string): AnthropicApiError {
    const { type, message } = response.error;

    // Tạo subclass phù hợp dựa trên type
    switch (type) {
      case 'authentication_error':
        return new AuthenticationError(message, requestId);
      case 'permission_error':
        return new PermissionError(message, requestId);
      case 'not_found_error':
        return new NotFoundError(message, requestId);
      case 'rate_limit_error':
        return new RateLimitError(message, requestId);
      case 'invalid_request_error':
        return new InvalidRequestError(message, requestId);
      case 'overloaded_error':
        return new OverloadedError(message, requestId);
      case 'api_error':
      default:
        return new InternalServerError(message, requestId);
    }
  }

  /**
   * Kiểm tra có nên retry request không
   */
  get isRetryable(): boolean {
    return (
      this.type === 'rate_limit_error' ||
      this.type === 'overloaded_error' ||
      this.type === 'api_error' ||
      this.status >= 500
    );
  }
}

// ============================================================================
// Specific Error Classes - Các lớp lỗi cụ thể
// ============================================================================

/**
 * Lỗi xác thực - API key không hợp lệ hoặc hết hạn
 * HTTP 401
 */
export class AuthenticationError extends AnthropicApiError {
  constructor(message: string, requestId?: string) {
    super(message, 'authentication_error', 401, requestId);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Lỗi quyền truy cập - Không có quyền sử dụng resource
 * HTTP 403
 */
export class PermissionError extends AnthropicApiError {
  constructor(message: string, requestId?: string) {
    super(message, 'permission_error', 403, requestId);
    this.name = 'PermissionError';
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

/**
 * Lỗi không tìm thấy - Resource không tồn tại
 * HTTP 404
 */
export class NotFoundError extends AnthropicApiError {
  constructor(message: string, requestId?: string) {
    super(message, 'not_found_error', 404, requestId);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Lỗi rate limit - Gửi quá nhiều requests
 * HTTP 429
 */
export class RateLimitError extends AnthropicApiError {
  /** Thời gian chờ trước khi retry (seconds) */
  public readonly retryAfter?: number;

  constructor(message: string, requestId?: string, retryAfter?: number) {
    super(message, 'rate_limit_error', 429, requestId);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  /**
   * Tạo từ response headers
   */
  static fromHeaders(message: string, headers: Headers, requestId?: string): RateLimitError {
    const retryAfterHeader = headers.get('retry-after');
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    return new RateLimitError(message, requestId, retryAfter);
  }
}

/**
 * Lỗi request không hợp lệ - Thiếu field hoặc format sai
 * HTTP 400
 */
export class InvalidRequestError extends AnthropicApiError {
  constructor(message: string, requestId?: string) {
    super(message, 'invalid_request_error', 400, requestId);
    this.name = 'InvalidRequestError';
    Object.setPrototypeOf(this, InvalidRequestError.prototype);
  }
}

/**
 * Lỗi server quá tải - Tạm thời không thể xử lý
 * HTTP 529
 */
export class OverloadedError extends AnthropicApiError {
  constructor(message: string, requestId?: string) {
    super(message, 'overloaded_error', 529, requestId);
    this.name = 'OverloadedError';
    Object.setPrototypeOf(this, OverloadedError.prototype);
  }
}

/**
 * Lỗi server nội bộ - Có vấn đề ở phía Anthropic
 * HTTP 500
 */
export class InternalServerError extends AnthropicApiError {
  constructor(message: string, requestId?: string) {
    super(message, 'api_error', 500, requestId);
    this.name = 'InternalServerError';
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

// ============================================================================
// Client-Side Errors - Lỗi ở phía client
// ============================================================================

/**
 * Lỗi timeout - Request mất quá lâu
 */
export class TimeoutError extends Error {
  /** Thời gian timeout (ms) */
  public readonly timeout: number;

  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
    this.timeout = timeout;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Lỗi kết nối mạng
 */
export class ConnectionError extends Error {
  /** Lỗi gốc */
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConnectionError';
    this.cause = cause;
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Lỗi stream bị ngắt giữa chừng
 */
export class StreamAbortedError extends Error {
  constructor(reason?: string) {
    super(reason || 'Stream was aborted');
    this.name = 'StreamAbortedError';
    Object.setPrototypeOf(this, StreamAbortedError.prototype);
  }
}

/**
 * Lỗi parse JSON response
 */
export class ParseError extends Error {
  /** Raw response text */
  public readonly rawResponse: string;

  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = 'ParseError';
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

// ============================================================================
// Error Utilities - Các hàm tiện ích
// ============================================================================

/**
 * Kiểm tra có phải là Anthropic API error không
 */
export function isAnthropicError(error: unknown): error is AnthropicApiError {
  return error instanceof AnthropicApiError;
}

/**
 * Kiểm tra có nên retry request không
 */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof AnthropicApiError) {
    return error.isRetryable;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof ConnectionError) {
    return true;
  }
  return false;
}

/**
 * Tính thời gian chờ trước khi retry (exponential backoff)
 *
 * @param attempt - Số lần đã thử (bắt đầu từ 0)
 * @param baseDelay - Delay cơ sở (ms), default 1000
 * @param maxDelay - Delay tối đa (ms), default 60000
 */
export function getRetryDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 60000
): number {
  // Exponential backoff với jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  const delay = exponentialDelay + jitter;

  return Math.min(delay, maxDelay);
}

/**
 * Format error để hiển thị cho user
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof AuthenticationError) {
    return 'API key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại API key.';
  }
  if (error instanceof RateLimitError) {
    const wait = error.retryAfter ? ` Vui lòng đợi ${error.retryAfter} giây.` : '';
    return `Đã vượt quá giới hạn request.${wait}`;
  }
  if (error instanceof OverloadedError) {
    return 'Server đang quá tải. Vui lòng thử lại sau.';
  }
  if (error instanceof InvalidRequestError) {
    return `Request không hợp lệ: ${error.message}`;
  }
  if (error instanceof TimeoutError) {
    return `Request đã timeout sau ${error.timeout / 1000} giây.`;
  }
  if (error instanceof ConnectionError) {
    return 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Đã xảy ra lỗi không xác định.';
}
