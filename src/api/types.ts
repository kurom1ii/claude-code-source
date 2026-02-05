/**
 * Claude Code API - Type Definitions
 * Các kiểu dữ liệu cho Anthropic Messages API
 */

// ============================================================================
// Content Block Types - Các loại nội dung trong message
// ============================================================================

/**
 * Text content block - Nội dung văn bản thuần túy
 */
export interface TextBlock {
  type: 'text';
  text: string;
}

/**
 * Thinking content block - Nội dung suy nghĩ/reasoning của model (extended thinking)
 */
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

/**
 * Tool use content block - Model yêu cầu gọi tool
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result content block - Kết quả trả về từ tool
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

/**
 * Image content block - Nội dung hình ảnh
 */
export interface ImageBlock {
  type: 'image';
  source: ImageSource;
}

export interface ImageSource {
  type: 'base64' | 'url';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data?: string;  // Base64 encoded data
  url?: string;   // URL to image
}

/**
 * Document content block - Nội dung PDF
 */
export interface DocumentBlock {
  type: 'document';
  source: DocumentSource;
}

export interface DocumentSource {
  type: 'base64';
  media_type: 'application/pdf';
  data: string;
}

/**
 * Union type cho tất cả content blocks
 */
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock
  | DocumentBlock;

// ============================================================================
// Message Types - Cấu trúc tin nhắn
// ============================================================================

/**
 * Role của message
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Message trong conversation
 */
export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
}

/**
 * User message - Tin nhắn từ người dùng
 */
export interface UserMessage {
  role: 'user';
  content: string | ContentBlock[];
}

/**
 * Assistant message - Tin nhắn từ Claude
 */
export interface AssistantMessage {
  role: 'assistant';
  content: ContentBlock[];
}

// ============================================================================
// Tool Definition Types - Định nghĩa tool
// ============================================================================

/**
 * JSON Schema cho tool parameter
 */
export interface JsonSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty;
  enum?: string[];
}

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
}

/**
 * Tool definition cho API request
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

/**
 * Tool choice configuration
 */
export type ToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'none' }
  | { type: 'tool'; name: string };

// ============================================================================
// Request Types - Cấu trúc API request
// ============================================================================

/**
 * Metadata cho request
 */
export interface RequestMetadata {
  user_id?: string;
}

/**
 * System prompt configuration
 */
export type SystemPrompt = string | SystemPromptBlock[];

export interface SystemPromptBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

export interface CacheControl {
  type: 'ephemeral';
}

/**
 * Thinking configuration cho extended thinking
 */
export interface ThinkingConfig {
  type: 'enabled';
  budget_tokens: number;
}

/**
 * Main API request body
 */
export interface CreateMessageRequest {
  // Required fields
  model: string;
  max_tokens: number;
  messages: Message[];

  // Optional fields
  system?: SystemPrompt;
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  metadata?: RequestMetadata;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;

  // Extended thinking
  thinking?: ThinkingConfig;

  // Prompt caching
  anthropic_beta?: string[];
}

// ============================================================================
// Response Types - Cấu trúc API response
// ============================================================================

/**
 * Token usage information
 */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Stop reason khi model dừng generate
 */
export type StopReason =
  | 'end_turn'      // Model hoàn thành tự nhiên
  | 'max_tokens'    // Đạt giới hạn max_tokens
  | 'stop_sequence' // Gặp stop sequence
  | 'tool_use';     // Model muốn sử dụng tool

/**
 * Main API response
 */
export interface CreateMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: ContentBlock[];
  stop_reason: StopReason | null;
  stop_sequence: string | null;
  usage: Usage;
}

// ============================================================================
// Streaming Types - Server-Sent Events
// ============================================================================

/**
 * Message start event
 */
export interface MessageStartEvent {
  type: 'message_start';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: [];
    stop_reason: null;
    stop_sequence: null;
    usage: Usage;
  };
}

/**
 * Content block start event
 */
export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: Partial<ContentBlock>;
}

/**
 * Content block delta event - Incremental update
 */
export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: ContentDelta;
}

export type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'input_json_delta'; partial_json: string };

/**
 * Content block stop event
 */
export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

/**
 * Message delta event - Final update
 */
export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason: StopReason;
    stop_sequence: string | null;
  };
  usage: {
    output_tokens: number;
  };
}

/**
 * Message stop event
 */
export interface MessageStopEvent {
  type: 'message_stop';
}

/**
 * Ping event để giữ kết nối
 */
export interface PingEvent {
  type: 'ping';
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

/**
 * Union type cho tất cả streaming events
 */
export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

// ============================================================================
// Error Types - Các loại lỗi API
// ============================================================================

/**
 * API Error response
 */
export interface ApiErrorResponse {
  type: 'error';
  error: {
    type: ApiErrorType;
    message: string;
  };
}

/**
 * Các loại lỗi có thể xảy ra
 */
export type ApiErrorType =
  | 'invalid_request_error'  // Request không hợp lệ
  | 'authentication_error'   // API key sai
  | 'permission_error'       // Không có quyền truy cập
  | 'not_found_error'        // Resource không tồn tại
  | 'rate_limit_error'       // Vượt quá rate limit
  | 'api_error'              // Lỗi server nội bộ
  | 'overloaded_error';      // Server quá tải

// ============================================================================
// Utility Types - Các type hỗ trợ
// ============================================================================

/**
 * Partial message builder - Dùng khi đang stream
 */
export interface PartialMessage {
  id: string;
  model: string;
  content: Partial<ContentBlock>[];
  usage: Partial<Usage>;
  stopReason?: StopReason;
}

/**
 * Options cho API client
 */
export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
  defaultMaxTokens?: number;
}

/**
 * Headers cho API request
 */
export interface ApiHeaders {
  'Content-Type': 'application/json';
  'X-Api-Key': string;
  'anthropic-version': string;
  'anthropic-beta'?: string;
}
