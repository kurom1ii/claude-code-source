/**
 * Claude Code - Type Definitions
 * Các kiểu dữ liệu chính được sử dụng trong toàn bộ ứng dụng
 */

// ============================================================================
// Message Types - Kiểu tin nhắn
// ============================================================================

/** Vai trò trong cuộc hội thoại */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Loại content block */
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image';

/** Text content block */
export interface TextBlock {
  type: 'text';
  text: string;
}

/** Tool use content block - Khi AI gọi tool */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Tool result content block - Kết quả từ tool */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/** Thinking content block - Suy nghĩ của AI */
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

/** Image content block */
export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/** Union type cho tất cả content blocks */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock | ImageBlock;

/** Message structure */
export interface Message {
  role: MessageRole;
  content: ContentBlock[] | string;
}

// ============================================================================
// Tool Types - Kiểu cho Tools
// ============================================================================

/** JSON Schema cho tool input */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
  }>;
  required?: string[];
}

/** Tool definition */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

/** Tool result */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

/** Tool handler function type */
export type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;

/** Registered tool với handler */
export interface RegisteredTool extends ToolDefinition {
  handler: ToolHandler;
}

// ============================================================================
// API Types - Kiểu cho Anthropic API
// ============================================================================

/** Usage statistics */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** API Request */
export interface CreateMessageRequest {
  model: string;
  max_tokens: number;
  messages: Message[];
  system?: string;
  tools?: ToolDefinition[];
  stream?: boolean;
  thinking?: {
    type: 'enabled';
    budget_tokens: number;
  };
}

/** API Response */
export interface CreateMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  stop_sequence?: string;
  usage: Usage;
}

/** Stream event types */
export type StreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'ping'
  | 'error';

/** Stream event */
export interface StreamEvent {
  type: StreamEventType;
  index?: number;
  content_block?: ContentBlock;
  delta?: {
    type: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
  };
  message?: CreateMessageResponse;
  usage?: Usage;
  error?: {
    type: string;
    message: string;
  };
}

// ============================================================================
// Model Types - Kiểu cho Models
// ============================================================================

/** Model information */
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
}

/** Model alias */
export interface ModelAlias {
  alias: string;
  modelId: string;
  description: string;
}

// ============================================================================
// Slash Command Types - Kiểu cho Slash Commands
// ============================================================================

/** Command context */
export interface CommandContext {
  messages: Message[];
  tools: RegisteredTool[];
  model: string;
  workingDirectory: string;
}

/** Slash command definition */
export interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  argumentHint?: string;
  isHidden?: boolean;
  isEnabled?: () => boolean;
  execute: (args: string, context: CommandContext) => Promise<void>;
}

// ============================================================================
// Agent Types - Kiểu cho Agents/Subagents
// ============================================================================

/** Agent type */
export type AgentType = 'Plan' | 'Explore' | 'general-purpose' | string;

/** Agent definition */
export interface AgentDefinition {
  type: AgentType;
  name: string;
  description: string;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
}

/** Agent task */
export interface AgentTask {
  id: string;
  prompt: string;
  agentType: AgentType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

// ============================================================================
// MCP Types - Model Context Protocol
// ============================================================================

/** MCP Server config */
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** MCP Resource */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** MCP Tool */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

// ============================================================================
// Config Types - Kiểu cho Configuration
// ============================================================================

/** App configuration */
export interface AppConfig {
  apiKey?: string;
  model: string;
  maxTokens: number;
  contextLimit: number;
  workingDirectory: string;
  debug: boolean;
  verbose: boolean;
}

/** Theme colors */
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
}

/** Theme definition */
export interface Theme {
  name: string;
  colors: ThemeColors;
}

// ============================================================================
// UI State Types - Kiểu cho UI State
// ============================================================================

/** App mode */
export type AppMode = 'code' | 'plan' | 'bash';

/** App state */
export interface AppState {
  mode: AppMode;
  isThinking: boolean;
  thinkingEnabled: boolean;
  currentModel: string;
  messages: Message[];
  tools: RegisteredTool[];
}

/** Input state */
export interface InputState {
  value: string;
  cursorPosition: number;
  history: string[];
  historyIndex: number;
}
