/**
 * Claude Code - Utility Functions
 * Các hàm tiện ích chung
 */

import { createHash } from 'crypto';

// ============================================================================
// String Utilities - Xử lý chuỗi
// ============================================================================

/**
 * Escape special regex characters
 * @param str - Chuỗi cần escape
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape chuỗi cho JSON
 * @param str - Chuỗi cần escape
 */
export function escapeJson(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Truncate chuỗi với ellipsis
 * @param str - Chuỗi gốc
 * @param maxLength - Độ dài tối đa
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize chữ cái đầu
 * @param str - Chuỗi gốc
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Number Utilities - Xử lý số
// ============================================================================

/**
 * Format số với separators (1000 -> 1,000)
 * @param num - Số cần format
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format token count cho hiển thị
 * @param tokens - Số tokens
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Clamp số trong khoảng
 * @param value - Giá trị
 * @param min - Giá trị nhỏ nhất
 * @param max - Giá trị lớn nhất
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// Version Utilities - Xử lý version
// ============================================================================

/**
 * So sánh 2 version strings
 * @param v1 - Version 1
 * @param v2 - Version 2
 * @returns -1 nếu v1 < v2, 0 nếu bằng, 1 nếu v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

// ============================================================================
// Hash Utilities - Tạo hash
// ============================================================================

/**
 * Tạo SHA256 hash
 * @param content - Nội dung cần hash
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Tạo short ID từ content
 * @param content - Nội dung
 * @param length - Độ dài ID (default: 8)
 */
export function shortId(content: string, length = 8): string {
  return sha256(content).slice(0, length);
}

/**
 * Tạo unique ID
 */
export function uniqueId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Path Utilities - Xử lý đường dẫn
// ============================================================================

import { resolve, relative, dirname, basename, extname, join } from 'path';
import { homedir } from 'os';

/**
 * Expand ~ trong path
 * @param filepath - Đường dẫn
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return join(homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Normalize đường dẫn
 * @param filepath - Đường dẫn
 */
export function normalizePath(filepath: string): string {
  return resolve(expandHome(filepath));
}

/**
 * Lấy relative path từ working directory
 * @param filepath - Đường dẫn tuyệt đối
 * @param from - Thư mục gốc (default: cwd)
 */
export function getRelativePath(filepath: string, from = process.cwd()): string {
  return relative(from, filepath);
}

// ============================================================================
// Async Utilities - Xử lý async
// ============================================================================

/**
 * Sleep function
 * @param ms - Milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function với exponential backoff
 * @param fn - Function cần retry
 * @param maxRetries - Số lần retry tối đa
 * @param initialDelay - Delay ban đầu (ms)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Timeout wrapper
 * @param promise - Promise cần wrap
 * @param ms - Timeout in milliseconds
 * @param message - Error message
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// ============================================================================
// Environment Utilities - Xử lý environment
// ============================================================================

/**
 * Parse boolean từ env var
 * @param value - Giá trị env
 * @param defaultValue - Giá trị mặc định
 */
export function parseEnvBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Parse number từ env var
 * @param value - Giá trị env
 * @param defaultValue - Giá trị mặc định
 */
export function parseEnvNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Object Utilities - Xử lý object
// ============================================================================

/**
 * Deep clone object
 * @param obj - Object cần clone
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 * @param target - Target object
 * @param source - Source object
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue as object, sourceValue as object) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

// ============================================================================
// Token Estimation - Ước tính tokens
// ============================================================================

/**
 * Ước tính số tokens từ text (rough estimate)
 * Khoảng 4 characters = 1 token cho tiếng Anh
 * @param text - Text cần đếm
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Ước tính tokens cho message
 * @param content - Content blocks hoặc string
 */
export function estimateMessageTokens(content: unknown): number {
  if (typeof content === 'string') {
    return estimateTokens(content);
  }

  if (Array.isArray(content)) {
    return content.reduce((sum, block) => {
      if (typeof block === 'object' && block !== null && 'text' in block) {
        return sum + estimateTokens(String(block.text));
      }
      return sum + 50; // Estimate cho các block types khác
    }, 0);
  }

  return 0;
}
