/**
 * Claude Code - Configuration
 * Cấu hình ứng dụng và constants
 */

import type { ModelInfo, ModelAlias, Theme, ThemeColors } from '../types';

// ============================================================================
// Version Info - Thông tin phiên bản
// ============================================================================

export const VERSION = '2.1.30';
export const BUILD_TIME = '2026-02-05T00:00:00Z';
export const APP_NAME = 'claude-code';

// ============================================================================
// API Configuration - Cấu hình API
// ============================================================================

export const API_BASE_URL = 'https://api.anthropic.com';
export const API_VERSION = '2023-06-01';

/** Default context limit (200k tokens) */
export const DEFAULT_CONTEXT_LIMIT = 200_000;

/** Context limit cho 1M models */
export const CONTEXT_LIMIT_1M = 1_000_000;

/** Context limit cho 2M models */
export const CONTEXT_LIMIT_2M = 2_000_000;

/** Max output tokens mặc định */
export const DEFAULT_MAX_TOKENS = 8096;

// ============================================================================
// Models - Danh sách models hỗ trợ
// ============================================================================

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Mô hình mạnh nhất, suy luận sâu',
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Cân bằng tốc độ và chất lượng',
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    description: 'Mô hình Opus ổn định',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: 'Mô hình Sonnet ổn định',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Mô hình 3.5 Sonnet',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsThinking: false,
    supportsVision: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Mô hình nhanh và nhẹ',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsThinking: false,
    supportsVision: true,
  },
];

/** Aliases cho models */
export const MODEL_ALIASES: ModelAlias[] = [
  { alias: 'opus', modelId: 'claude-opus-4-5-20251101', description: 'Opus mới nhất' },
  { alias: 'sonnet', modelId: 'claude-sonnet-4-5-20250929', description: 'Sonnet mới nhất' },
  { alias: 'haiku', modelId: 'claude-3-5-haiku-20241022', description: 'Haiku nhanh' },
  { alias: 'opus4', modelId: 'claude-opus-4-20250514', description: 'Opus 4 ổn định' },
  { alias: 'sonnet4', modelId: 'claude-sonnet-4-20250514', description: 'Sonnet 4 ổn định' },
];

/** Model mặc định */
export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

// ============================================================================
// Feature Flags - Cờ tính năng
// ============================================================================

export const FEATURE_FLAGS = {
  /** Enable swarm mode (multi-agent) */
  SWARM_MODE: process.env.CLAUDE_CODE_AGENT_SWARMS === 'true',

  /** Enable session memory */
  SESSION_MEMORY: process.env.CC_SESSION_MEMORY === 'true',

  /** Enable extended thinking */
  EXTENDED_THINKING: true,

  /** Enable MCP integration */
  MCP_ENABLED: true,

  /** Non-blocking MCP connection */
  MCP_NON_BLOCKING: process.env.MCP_CONNECTION_NONBLOCKING === 'true',
};

// ============================================================================
// Environment Variables - Biến môi trường
// ============================================================================

/** Lấy context limit từ env hoặc default */
export function getContextLimit(): number {
  const envLimit = process.env.CLAUDE_CODE_CONTEXT_LIMIT;
  if (envLimit) {
    const parsed = parseInt(envLimit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_CONTEXT_LIMIT;
}

/** Lấy API key từ env */
export function getApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
}

/** Lấy working directory */
export function getWorkingDirectory(): string {
  return process.env.CLAUDE_CODE_WORKDIR || process.cwd();
}

// ============================================================================
// Themes - Themes cho UI
// ============================================================================

const darkColors: ThemeColors = {
  primary: '#7C3AED',    // Purple
  secondary: '#3B82F6',  // Blue
  success: '#10B981',    // Green
  warning: '#F59E0B',    // Amber
  error: '#EF4444',      // Red
  info: '#06B6D4',       // Cyan
  muted: '#6B7280',      // Gray
};

const lightColors: ThemeColors = {
  primary: '#6D28D9',
  secondary: '#2563EB',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0891B2',
  muted: '#9CA3AF',
};

export const THEMES: Theme[] = [
  { name: 'dark', colors: darkColors },
  { name: 'light', colors: lightColors },
];

export const DEFAULT_THEME = 'dark';

// ============================================================================
// Paths - Đường dẫn cấu hình
// ============================================================================

import { homedir } from 'os';
import { join } from 'path';

/** Thư mục config của Claude */
export const CLAUDE_CONFIG_DIR = join(homedir(), '.claude');

/** File settings */
export const SETTINGS_FILE = join(CLAUDE_CONFIG_DIR, 'settings.json');

/** File sessions */
export const SESSIONS_DIR = join(CLAUDE_CONFIG_DIR, 'sessions');

/** File projects */
export const PROJECTS_DIR = join(CLAUDE_CONFIG_DIR, 'projects');

// ============================================================================
// MCP Configuration
// ============================================================================

/** MCP server connection batch size */
export const MCP_BATCH_SIZE = parseInt(
  process.env.MCP_SERVER_CONNECTION_BATCH_SIZE || '3',
  10
);

/** MCP connection timeout (ms) */
export const MCP_CONNECTION_TIMEOUT = 30_000;

// ============================================================================
// Session Memory Configuration
// ============================================================================

export const SESSION_MEMORY_CONFIG = {
  /** Tokens per section */
  perSectionTokens: parseInt(process.env.CC_SM_PER_SECTION_TOKENS || '2000', 10),

  /** Total file limit */
  totalFileLimit: parseInt(process.env.CC_SM_TOTAL_FILE_LIMIT || '12000', 10),

  /** Minimum message tokens to init */
  minimumTokensToInit: parseInt(process.env.CC_SM_MINIMUM_MESSAGE_TOKENS_TO_INIT || '10000', 10),
};

// ============================================================================
// Thinking Verbs - Các động từ hiển thị khi thinking
// ============================================================================

export const THINKING_VERBS = [
  'Thinking',
  'Pondering',
  'Considering',
  'Analyzing',
  'Processing',
  'Evaluating',
  'Reflecting',
  'Reasoning',
  'Contemplating',
  'Deliberating',
];

/** Lấy random thinking verb */
export function getRandomThinkingVerb(): string {
  return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
}
