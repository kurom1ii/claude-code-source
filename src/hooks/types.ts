/**
 * Claude Code - Hook Types
 *
 * Định nghĩa các types cho hook system
 * Hooks cho phép users chạy shell commands hoặc LLM prompts
 * khi có events (tool calls, session start, etc.)
 */

import { z } from 'zod';

// ============================================================================
// Hook Event Types - Các loại events có thể trigger hooks
// ============================================================================

/**
 * Danh sách tất cả hook events được hỗ trợ
 * - PreToolUse: Trước khi tool được thực thi
 * - PostToolUse: Sau khi tool thực thi thành công
 * - PostToolUseFailure: Sau khi tool thực thi thất bại
 * - Notification: Khi có thông báo
 * - UserPromptSubmit: Khi user submit prompt
 * - SessionStart: Khi session bắt đầu
 * - SessionEnd: Khi session kết thúc
 * - Stop: Khi agent dừng
 * - SubagentStart: Khi subagent bắt đầu
 * - SubagentStop: Khi subagent dừng
 * - PreCompact: Trước khi compact context
 * - PermissionRequest: Khi yêu cầu permission
 * - Setup: Khi khởi tạo hoặc maintenance
 */
export const HookEventTypes = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PermissionRequest',
  'Setup',
] as const;

export type HookEventType = (typeof HookEventTypes)[number];

// ============================================================================
// Hook Definition Schemas - Zod schemas cho hook definitions
// ============================================================================

/**
 * Command Hook Schema
 * Chạy một bash command khi hook được trigger
 */
export const CommandHookSchema = z.object({
  /** Loại hook - command chạy bash */
  type: z.literal('command').describe('Bash command hook type'),

  /** Shell command để thực thi */
  command: z.string().describe('Shell command to execute'),

  /** Timeout tính bằng giây cho command này */
  timeout: z
    .number()
    .positive()
    .optional()
    .describe('Timeout in seconds for this specific command'),

  /** Message hiển thị trong spinner khi hook đang chạy */
  statusMessage: z
    .string()
    .optional()
    .describe('Custom status message to display in spinner while hook runs'),

  /** Nếu true, hook chỉ chạy một lần rồi bị remove */
  once: z.boolean().optional().describe('If true, hook runs once and is removed after execution'),

  /** Nếu true, hook chạy background không blocking */
  async: z.boolean().optional().describe('If true, hook runs in background without blocking'),
});

/**
 * Prompt Hook Schema
 * Gửi prompt tới LLM để evaluate khi hook được trigger
 */
export const PromptHookSchema = z.object({
  /** Loại hook - prompt gửi tới LLM */
  type: z.literal('prompt').describe('LLM prompt hook type'),

  /** Prompt để evaluate với LLM. Dùng $ARGUMENTS placeholder cho hook input JSON */
  prompt: z
    .string()
    .describe('Prompt to evaluate with LLM. Use $ARGUMENTS placeholder for hook input JSON.'),

  /** Timeout tính bằng giây */
  timeout: z
    .number()
    .positive()
    .optional()
    .describe('Timeout in seconds for this specific prompt evaluation'),

  /** Model để dùng cho prompt hook này */
  model: z
    .string()
    .optional()
    .describe(
      'Model to use for this prompt hook (e.g., "claude-sonnet-4-5-20250929"). If not specified, uses the default small fast model.'
    ),

  /** Message hiển thị trong spinner */
  statusMessage: z
    .string()
    .optional()
    .describe('Custom status message to display in spinner while hook runs'),

  /** Nếu true, hook chỉ chạy một lần */
  once: z.boolean().optional().describe('If true, hook runs once and is removed after execution'),
});

/**
 * Agent Hook Schema
 * Dùng một agent để verify kết quả
 */
export const AgentHookSchema = z.object({
  /** Loại hook - agent verifier */
  type: z.literal('agent').describe('Agentic verifier hook type'),

  /** Prompt mô tả những gì cần verify */
  prompt: z
    .string()
    .transform((prompt) => (_args: unknown[]) => prompt)
    .describe(
      'Prompt describing what to verify (e.g. "Verify that unit tests ran and passed."). Use $ARGUMENTS placeholder for hook input JSON.'
    ),

  /** Timeout tính bằng giây (default 60) */
  timeout: z
    .number()
    .positive()
    .optional()
    .describe('Timeout in seconds for agent execution (default 60)'),

  /** Model để dùng cho agent hook */
  model: z
    .string()
    .optional()
    .describe(
      'Model to use for this agent hook (e.g., "claude-sonnet-4-5-20250929"). If not specified, uses Haiku.'
    ),

  /** Message hiển thị trong spinner */
  statusMessage: z
    .string()
    .optional()
    .describe('Custom status message to display in spinner while hook runs'),

  /** Nếu true, hook chỉ chạy một lần */
  once: z.boolean().optional().describe('If true, hook runs once and is removed after execution'),
});

/**
 * Hook Definition Schema - Union của tất cả hook types
 */
export const HookDefinitionSchema = z.discriminatedUnion('type', [
  CommandHookSchema,
  PromptHookSchema,
  AgentHookSchema,
]);

// ============================================================================
// Hook Matcher Schema - Pattern matching cho hooks
// ============================================================================

/**
 * Hook Matcher Schema
 * Định nghĩa khi nào hook được trigger dựa trên pattern matching
 */
export const HookMatcherSchema = z.object({
  /** String pattern để match (e.g. tool names như "Write", "Read") */
  matcher: z.string().optional().describe('String pattern to match (e.g. tool names like "Write")'),

  /** Danh sách hooks để thực thi khi matcher match */
  hooks: z.array(HookDefinitionSchema).describe('List of hooks to execute when the matcher matches'),
});

// ============================================================================
// Hook Config Schema - Cấu hình hooks theo event type
// ============================================================================

/**
 * Hook Event Type Schema
 */
export const HookEventTypeSchema = z.enum(HookEventTypes as unknown as [string, ...string[]]);

/**
 * Hook Config Schema
 * Cấu hình hooks được nhóm theo event type
 */
export const HookConfigSchema = z.record(HookEventTypeSchema, z.array(HookMatcherSchema).optional());

// ============================================================================
// TypeScript Types - Inferred từ Zod schemas
// ============================================================================

/** Command hook - chạy bash command */
export type CommandHook = z.infer<typeof CommandHookSchema>;

/** Prompt hook - gửi prompt tới LLM */
export type PromptHook = z.infer<typeof PromptHookSchema>;

/** Agent hook - dùng agent để verify */
export type AgentHook = z.infer<typeof AgentHookSchema>;

/** Union type của tất cả hook definitions */
export type HookDefinition = z.infer<typeof HookDefinitionSchema>;

/** Hook matcher với pattern và danh sách hooks */
export type HookMatcher = z.infer<typeof HookMatcherSchema>;

/** Toàn bộ hook config */
export type HookConfig = z.infer<typeof HookConfigSchema>;

// ============================================================================
// Callback và Function Hook Types - Cho internal hooks
// ============================================================================

/**
 * Callback Hook Definition
 * Dùng cho internal hooks với callback function
 */
export interface CallbackHookDefinition {
  type: 'callback';
  /** Callback function được gọi khi hook trigger */
  callback: (
    input: HookInput,
    hookId: string,
    signal: AbortSignal,
    hookIndex: number,
    context?: HookContext
  ) => Promise<HookCallbackResponse>;
  /** Timeout tính bằng giây */
  timeout?: number;
}

/**
 * Function Hook Definition
 * Dùng cho Stop hooks với function callback
 */
export interface FunctionHookDefinition {
  type: 'function';
  /** Callback function nhận messages và signal */
  callback: (messages: unknown[], signal: AbortSignal) => Promise<boolean>;
  /** Error message khi hook fail */
  errorMessage: string;
  /** Timeout tính bằng mili giây */
  timeout?: number;
}

/**
 * Extended Hook Definition bao gồm cả internal hooks
 */
export type ExtendedHookDefinition =
  | HookDefinition
  | CallbackHookDefinition
  | FunctionHookDefinition;

// ============================================================================
// Hook Input Types - Input được truyền vào hooks
// ============================================================================

/**
 * Base hook input - thông tin chung cho tất cả hook inputs
 */
export interface BaseHookInput {
  /** Session ID hiện tại */
  session_id: string;
  /** Đường dẫn transcript file */
  transcript_path: string;
  /** Current working directory */
  cwd: string;
  /** Permission mode hiện tại */
  permission_mode?: string;
}

/**
 * PreToolUse hook input
 */
export interface PreToolUseHookInput extends BaseHookInput {
  hook_event_name: 'PreToolUse';
  /** Tên tool sắp được gọi */
  tool_name: string;
  /** Input của tool */
  tool_input: unknown;
  /** Tool use ID */
  tool_use_id: string;
}

/**
 * PostToolUse hook input
 */
export interface PostToolUseHookInput extends BaseHookInput {
  hook_event_name: 'PostToolUse';
  /** Tên tool đã được gọi */
  tool_name: string;
  /** Input của tool */
  tool_input: unknown;
  /** Response từ tool */
  tool_response: unknown;
  /** Tool use ID */
  tool_use_id: string;
}

/**
 * PostToolUseFailure hook input
 */
export interface PostToolUseFailureHookInput extends BaseHookInput {
  hook_event_name: 'PostToolUseFailure';
  /** Tên tool */
  tool_name: string;
  /** Input của tool */
  tool_input: unknown;
  /** Tool use ID */
  tool_use_id: string;
  /** Error message */
  error: string;
  /** Có phải do interrupt không */
  is_interrupt?: boolean;
}

/**
 * Notification hook input
 */
export interface NotificationHookInput extends BaseHookInput {
  hook_event_name: 'Notification';
  /** Nội dung thông báo */
  message: string;
  /** Tiêu đề thông báo */
  title?: string;
  /** Loại thông báo */
  notification_type: string;
}

/**
 * UserPromptSubmit hook input
 */
export interface UserPromptSubmitHookInput extends BaseHookInput {
  hook_event_name: 'UserPromptSubmit';
  /** Prompt từ user */
  prompt: string;
}

/**
 * SessionStart hook input
 */
export interface SessionStartHookInput extends BaseHookInput {
  hook_event_name: 'SessionStart';
  /** Source của session */
  source: 'startup' | 'resume' | 'clear' | 'compact';
  /** Loại agent */
  agent_type?: string;
  /** Model đang dùng */
  model?: string;
}

/**
 * SessionEnd hook input
 */
export interface SessionEndHookInput extends BaseHookInput {
  hook_event_name: 'SessionEnd';
  /** Lý do kết thúc */
  reason: 'clear' | 'logout' | 'prompt_input_exit' | 'other' | 'bypass_permissions_disabled';
}

/**
 * Setup hook input
 */
export interface SetupHookInput extends BaseHookInput {
  hook_event_name: 'Setup';
  /** Trigger source */
  trigger: 'init' | 'maintenance';
}

/**
 * Stop hook input
 */
export interface StopHookInput extends BaseHookInput {
  hook_event_name: 'Stop';
  /** Có stop hook đang active không */
  stop_hook_active: boolean;
}

/**
 * SubagentStart hook input
 */
export interface SubagentStartHookInput extends BaseHookInput {
  hook_event_name: 'SubagentStart';
  /** Agent ID */
  agent_id: string;
  /** Loại agent */
  agent_type: string;
}

/**
 * SubagentStop hook input
 */
export interface SubagentStopHookInput extends BaseHookInput {
  hook_event_name: 'SubagentStop';
  /** Có stop hook đang active không */
  stop_hook_active: boolean;
  /** Agent ID */
  agent_id: string;
  /** Đường dẫn transcript của agent */
  agent_transcript_path: string;
  /** Loại agent */
  agent_type: string;
}

/**
 * PreCompact hook input
 */
export interface PreCompactHookInput extends BaseHookInput {
  hook_event_name: 'PreCompact';
  /** Trigger source */
  trigger: 'manual' | 'auto';
  /** Custom instructions hiện tại */
  custom_instructions: string | null;
}

/**
 * PermissionRequest hook input
 */
export interface PermissionRequestHookInput extends BaseHookInput {
  hook_event_name: 'PermissionRequest';
  /** Tên tool yêu cầu permission */
  tool_name: string;
  /** Input của tool */
  tool_input: unknown;
  /** Gợi ý permission */
  permission_suggestions?: PermissionSuggestion[];
}

/**
 * Union type của tất cả hook inputs
 */
export type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | SetupHookInput
  | StopHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PermissionRequestHookInput;

// ============================================================================
// Hook Output Types - Output từ hooks
// ============================================================================

/**
 * Async response từ hook
 */
export interface AsyncHookResponse {
  async: true;
  /** Timeout cho async operation (ms) */
  asyncTimeout?: number;
}

/**
 * Permission decision type
 */
export type PermissionDecision = 'allow' | 'deny' | 'ask';

/**
 * Permission behavior type
 */
export type PermissionBehavior = 'allow' | 'deny' | 'ask' | 'passthrough';

/**
 * Permission suggestion type
 */
export interface PermissionSuggestion {
  type: 'addRules' | 'replaceRules' | 'removeRules' | 'setMode' | 'addDirectories' | 'removeDirectories';
  // Các fields khác tùy thuộc vào type
  [key: string]: unknown;
}

/**
 * Hook specific output cho PreToolUse
 */
export interface PreToolUseHookOutput {
  hookEventName: 'PreToolUse';
  /** Permission decision từ hook */
  permissionDecision?: PermissionDecision;
  /** Lý do cho decision */
  permissionDecisionReason?: string;
  /** Updated input cho tool */
  updatedInput?: Record<string, unknown>;
  /** Additional context để inject vào conversation */
  additionalContext?: string;
}

/**
 * Hook specific output cho PostToolUse
 */
export interface PostToolUseHookOutput {
  hookEventName: 'PostToolUse';
  /** Additional context */
  additionalContext?: string;
  /** Updated MCP tool output */
  updatedMCPToolOutput?: unknown;
}

/**
 * Hook specific output cho PermissionRequest
 */
export interface PermissionRequestHookOutput {
  hookEventName: 'PermissionRequest';
  decision:
    | {
        behavior: 'allow';
        updatedInput?: Record<string, unknown>;
        updatedPermissions?: PermissionSuggestion[];
      }
    | {
        behavior: 'deny';
        message?: string;
        interrupt?: boolean;
      };
}

/**
 * Generic hook specific output
 */
export interface GenericHookOutput {
  hookEventName:
    | 'UserPromptSubmit'
    | 'SessionStart'
    | 'Setup'
    | 'SubagentStart'
    | 'PostToolUseFailure'
    | 'Notification';
  additionalContext?: string;
}

/**
 * Hook specific output union
 */
export type HookSpecificOutput =
  | PreToolUseHookOutput
  | PostToolUseHookOutput
  | PermissionRequestHookOutput
  | GenericHookOutput;

/**
 * Synchronous hook response
 */
export interface SyncHookResponse {
  /** Có tiếp tục sau hook không (default: true) */
  continue?: boolean;
  /** Ẩn stdout khỏi transcript (default: false) */
  suppressOutput?: boolean;
  /** Message hiển thị khi continue là false */
  stopReason?: string;
  /** Decision từ hook */
  decision?: 'approve' | 'block';
  /** Lý do cho decision */
  reason?: string;
  /** Warning message hiển thị cho user */
  systemMessage?: string;
  /** Event-specific output */
  hookSpecificOutput?: HookSpecificOutput;
}

/**
 * Hook response có thể là async hoặc sync
 */
export type HookResponse = AsyncHookResponse | SyncHookResponse;

/**
 * Callback hook response
 */
export type HookCallbackResponse = AsyncHookResponse | SyncHookResponse;

// ============================================================================
// Hook Execution Types - Types cho hook execution
// ============================================================================

/**
 * Hook context cho callback hooks
 */
export interface HookContext {
  getAppState: () => Promise<unknown>;
  setAppState: (updater: (state: unknown) => unknown) => void;
}

/**
 * Hook execution outcome
 */
export type HookOutcome = 'success' | 'blocking' | 'non_blocking_error' | 'cancelled';

/**
 * Blocking error từ hook
 */
export interface HookBlockingError {
  blockingError: string;
  command: string;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  /** Outcome của execution */
  outcome: HookOutcome;
  /** Hook definition đã chạy */
  hook: ExtendedHookDefinition;
  /** Message để hiển thị */
  message?: unknown;
  /** Blocking error nếu có */
  blockingError?: HookBlockingError;
  /** System message từ hook */
  systemMessage?: string;
  /** Additional context từ hook */
  additionalContext?: string;
  /** Permission behavior từ hook */
  permissionBehavior?: PermissionBehavior;
  /** Lý do cho permission decision */
  hookPermissionDecisionReason?: string;
  /** Updated input cho tool */
  updatedInput?: Record<string, unknown>;
  /** Updated MCP tool output */
  updatedMCPToolOutput?: unknown;
  /** Permission request result */
  permissionRequestResult?: unknown;
  /** Ngăn không cho tiếp tục */
  preventContinuation?: boolean;
  /** Lý do stop */
  stopReason?: string;
}

/**
 * Matched hook với metadata
 */
export interface MatchedHook {
  /** Hook definition */
  hook: ExtendedHookDefinition;
  /** Plugin root nếu từ plugin */
  pluginRoot?: string;
  /** Skill root nếu từ skill */
  skillRoot?: string;
}

// ============================================================================
// Hook Source Types - Nguồn của hooks
// ============================================================================

/**
 * Nguồn của hook config
 */
export type HookSource =
  | 'userSettings' // ~/.claude/settings.json
  | 'projectSettings' // .claude/settings.json
  | 'localSettings' // .claude/settings.local.json
  | 'pluginHook' // ~/.claude/plugins/*/hooks/hooks.json
  | 'sessionHook'; // In-memory, temporary

/**
 * Mô tả nguồn hook
 */
export function getHookSourceDescription(source: HookSource): string {
  switch (source) {
    case 'userSettings':
      return 'User settings (~/.claude/settings.json)';
    case 'projectSettings':
      return 'Project settings (.claude/settings.json)';
    case 'localSettings':
      return 'Local settings (.claude/settings.local.json)';
    case 'pluginHook':
      return 'Plugin hooks (~/.claude/plugins/*/hooks/hooks.json)';
    case 'sessionHook':
      return 'Session hooks (in-memory, temporary)';
    default:
      return source;
  }
}

// ============================================================================
// Type Guards - Kiểm tra loại hook
// ============================================================================

/**
 * Kiểm tra có phải async response không
 */
export function isAsyncResponse(response: unknown): response is AsyncHookResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'async' in response &&
    (response as AsyncHookResponse).async === true
  );
}

/**
 * Kiểm tra có phải sync response không (có content)
 */
export function isSyncResponse(response: unknown): response is SyncHookResponse {
  return !isAsyncResponse(response);
}

/**
 * Kiểm tra có phải command hook không
 */
export function isCommandHook(hook: ExtendedHookDefinition): hook is CommandHook {
  return hook.type === 'command';
}

/**
 * Kiểm tra có phải prompt hook không
 */
export function isPromptHook(hook: ExtendedHookDefinition): hook is PromptHook {
  return hook.type === 'prompt';
}

/**
 * Kiểm tra có phải agent hook không
 */
export function isAgentHook(hook: ExtendedHookDefinition): hook is AgentHook {
  return hook.type === 'agent';
}

/**
 * Kiểm tra có phải callback hook không
 */
export function isCallbackHook(hook: ExtendedHookDefinition): hook is CallbackHookDefinition {
  return hook.type === 'callback';
}

/**
 * Kiểm tra có phải function hook không
 */
export function isFunctionHook(hook: ExtendedHookDefinition): hook is FunctionHookDefinition {
  return hook.type === 'function';
}
